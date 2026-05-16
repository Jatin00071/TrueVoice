const DB_NAME = 'truevoice-message-queue';
const STORE = 'messages';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('conversationId', 'conversationId');
        store.createIndex('status', 'status');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function tx(mode, callback) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    let result;
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    result = callback(store);
  }).finally(() => db.close());
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addToQueue(conversationId, message) {
  const queued = {
    ...message,
    id: message.id || `local:${crypto.randomUUID()}`,
    conversationId,
    status: 'pending',
    retryCount: 0,
    maxRetries: 10,
    lastRetryAt: null,
    createdAt: new Date().toISOString()
  };
  await tx('readwrite', (store) => store.put(queued));
  return queued;
}

export async function updateQueuedMessage(id, updates) {
  return tx('readwrite', (store) => {
    const request = store.get(id);
    request.onsuccess = () => {
      if (request.result) store.put({ ...request.result, ...updates });
    };
    return request;
  });
}

export async function markSent(messageId) {
  return updateQueuedMessage(messageId, { status: 'sent', sentAt: new Date().toISOString() });
}

export async function markFailed(messageId, error) {
  const existing = await getById(messageId);
  const nextRetryCount = Number(existing?.retryCount || 0) + 1;
  const maxRetries = Number(existing?.maxRetries || 10);
  return updateQueuedMessage(messageId, {
    status: nextRetryCount >= maxRetries ? 'failed' : 'pending',
    error: error?.message || String(error || 'Not delivered'),
    retryCount: nextRetryCount,
    lastRetryAt: new Date().toISOString()
  });
}

export async function getById(messageId) {
  return tx('readonly', (store) => requestToPromise(store.get(messageId)));
}

export async function getPendingByConversation(conversationId) {
  const all = await getAll();
  return all.filter((item) => String(item.conversationId) === String(conversationId) && item.status === 'pending');
}

export async function getRetryable() {
  const all = await getAll();
  const now = Date.now();
  return all.filter((item) => {
    if (!['pending', 'failed'].includes(item.status)) return false;
    if (Number(item.retryCount || 0) >= Number(item.maxRetries || 10)) return false;
    if (!item.lastRetryAt) return true;
    return now - new Date(item.lastRetryAt).getTime() >= 2000;
  });
}

export async function clearOldSuccessful() {
  const all = await getAll();
  const cutoff = Date.now() - 60 * 60 * 1000;
  await Promise.all(
    all
      .filter((item) => item.status === 'sent' && new Date(item.sentAt || item.createdAt).getTime() < cutoff)
      .map((item) => tx('readwrite', (store) => store.delete(item.id)))
  );
}

export async function getAll() {
  return tx('readonly', (store) => requestToPromise(store.getAll()));
}

export async function retryMessage(messageId) {
  const item = await getById(messageId);
  if (!item) return null;
  await updateQueuedMessage(messageId, {
    status: 'pending',
    retryCount: Number(item.retryCount || 0) + 1,
    lastRetryAt: new Date().toISOString()
  });
  return { ...item, status: 'pending', retryCount: Number(item.retryCount || 0) + 1 };
}
