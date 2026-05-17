import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthContext } from '../hooks/useAuth.js';
import { exchangeKeys, getPublicKey, publishIdentityKey, verifyKeys } from '../api/cryptoApi.js';
import { CryptoContext } from './cryptoStore.js';
import '../utils/cryptoDebug.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const CRYPTO_DB = 'truevoice-crypto-keys';
const CRYPTO_STORE = 'identities';
const CRYPTO_DB_VERSION = 1;

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function importPublicKey(publicKey) {
  return crypto.subtle.importKey('jwk', JSON.parse(atob(publicKey)), { name: 'ECDH', namedCurve: 'P-256' }, true, []);
}

function openCryptoDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not available'));
      return;
    }

    const request = window.indexedDB.open(CRYPTO_DB, CRYPTO_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CRYPTO_STORE)) {
        db.createObjectStore(CRYPTO_STORE, { keyPath: 'userId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function cryptoTx(mode, callback) {
  const db = await openCryptoDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CRYPTO_STORE, mode);
    const store = transaction.objectStore(CRYPTO_STORE);
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

function loadIdentityRecord(userId) {
  return cryptoTx('readonly', (store) => requestToPromise(store.get(String(userId))));
}

function saveIdentityRecord(record) {
  return cryptoTx('readwrite', (store) => store.put({ ...record, userId: String(record.userId) }));
}

async function importPrivateKey(privateJwk) {
  return crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']);
}

async function buildIdentityFromRecord(record) {
  if (!record?.privateKey || !record?.publicJwk || !record?.fingerprint) return null;
  const publicKey = await crypto.subtle.importKey('jwk', record.publicJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
  return {
    privateKey: record.privateKey,
    publicKey,
    publicKeyString: btoa(JSON.stringify(record.publicJwk)),
    fingerprint: record.fingerprint
  };
}

async function deriveAesKey(privateKey, publicKey) {
  const importedPublic = await importPublicKey(publicKey);
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: importedPublic },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function uniqueKeys(keys = []) {
  const byUser = new Map();
  keys.filter(Boolean).forEach((key) => {
    if (key.user_id != null) byUser.set(String(key.user_id), key);
  });
  return Array.from(byUser.values());
}

export function CryptoProvider({ children }) {
  const { user } = useAuthContext();
  const [identity, setIdentity] = useState(null);
  const [conversationKeys, setConversationKeys] = useState({});
  const [lastCryptoError, setLastCryptoError] = useState(null);
  const identityRef = useRef(null);
  const publishedIdentityRef = useRef(null);

  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);

  useEffect(() => {
    if (!identity?.publicKeyString || !user?.id) return;
    const publishKey = `${user.id}:${identity.fingerprint}`;
    if (publishedIdentityRef.current === publishKey) return;

    publishedIdentityRef.current = publishKey;
    publishIdentityKey({ publicKey: identity.publicKeyString, keyFingerprint: identity.fingerprint }).catch((error) => {
      publishedIdentityRef.current = null;
      console.warn('[Crypto] Failed to publish identity key:', error);
      setLastCryptoError(error?.response?.data?.message || error.message || 'Failed to publish encryption identity');
    });
  }, [identity?.fingerprint, identity?.publicKeyString, user?.id]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!user?.id || !crypto?.subtle) return;
      const storageKey = `tv:crypto:${user.id}`;
      const storedRecord = await loadIdentityRecord(user.id);
      const storedIdentity = await buildIdentityFromRecord(storedRecord);

      if (storedIdentity) {
        if (!cancelled) setIdentity(storedIdentity);
        return;
      }

      const legacyIdentity = window.localStorage.getItem(storageKey);
      if (legacyIdentity) {
        const parsed = JSON.parse(legacyIdentity);
        const privateKey = await importPrivateKey(parsed.privateJwk);
        const publicKey = await crypto.subtle.importKey('jwk', parsed.publicJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
        await saveIdentityRecord({
          userId: user.id,
          privateKey,
          publicJwk: parsed.publicJwk,
          fingerprint: parsed.fingerprint
        });
        window.localStorage.removeItem(storageKey);
        if (!cancelled) {
          setIdentity({ privateKey, publicKey, publicKeyString: btoa(JSON.stringify(parsed.publicJwk)), fingerprint: parsed.fingerprint });
        }
        return;
      }

      const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
      const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
      const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
      const privateKey = await importPrivateKey(privateJwk);
      const publicKey = await crypto.subtle.importKey('jwk', publicJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
      const publicKeyString = btoa(JSON.stringify(publicJwk));
      const fingerprint = await sha256Hex(publicKeyString);
      await saveIdentityRecord({ userId: user.id, privateKey, publicJwk, fingerprint });
      if (!cancelled) setIdentity({ privateKey, publicKey, publicKeyString, fingerprint });
    }

    init().catch((error) => {
      console.error('[Crypto] Failed to initialize identity:', error);
      setLastCryptoError(error.message || 'Failed to initialize encryption identity');
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const cacheConversationKey = useCallback((conversationId, key) => {
    if (!conversationId || !key?.user_id) return;
    setConversationKeys((current) => ({
      ...current,
      [conversationId]: uniqueKeys([...(current[conversationId] || []), key])
    }));
  }, []);

  const publishKey = useCallback(async (conversationId) => {
    if (!identity || !conversationId) return null;
    const response = await exchangeKeys({ conversationId, publicKey: identity.publicKeyString, keyFingerprint: identity.fingerprint });
    if (response?.key) cacheConversationKey(conversationId, response.key);
    return response;
  }, [cacheConversationKey, identity]);

  const waitForIdentityReady = useCallback(async (timeoutMs = 2000) => {
    const started = Date.now();
    while (!identityRef.current && Date.now() - started < timeoutMs) {
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    if (!identityRef.current) throw new Error('Encryption identity failed to initialize');
    return identityRef.current;
  }, []);

  const loadConversationKeys = useCallback(async (conversationId) => {
    if (!conversationId) return [];
    const data = await verifyKeys(conversationId);
    const keys = data.keys || [];
    setConversationKeys((current) => ({ ...current, [conversationId]: uniqueKeys(keys) }));
    return keys;
  }, []);

  const fetchAndCachePublicKey = useCallback(async (conversationId, userId) => {
    if (!userId) return null;
    const response = await getPublicKey(userId);
    const key = response?.key || null;
    if (key) cacheConversationKey(conversationId, key);
    return key;
  }, [cacheConversationKey]);

  const getPeerKey = useCallback(async (conversationId, peerUserId = null) => {
    if (!conversationId) return null;
    let keys = conversationKeys[conversationId];
    if (!keys) keys = await loadConversationKeys(conversationId);

    let peer = keys?.find((key) => String(key.user_id) !== String(user?.id));
    if (peer?.public_key) return peer;

    const response = await verifyKeys(conversationId);
    keys = response.keys || [];
    setConversationKeys((current) => ({ ...current, [conversationId]: uniqueKeys(keys) }));
    peer = keys.find((key) => String(key.user_id) !== String(user?.id));
    if (peer?.public_key) return peer;

    if (peerUserId) {
      try {
        return await fetchAndCachePublicKey(conversationId, peerUserId);
      } catch (error) {
        console.warn(`[Crypto] Failed to fetch public key for peer ${peerUserId}:`, error);
      }
    }

    return null;
  }, [conversationKeys, fetchAndCachePublicKey, loadConversationKeys, user?.id]);

  const getSenderKey = useCallback(async (conversationId, senderId) => {
    let keys = conversationKeys[conversationId];
    if (!keys) keys = await loadConversationKeys(conversationId);

    let senderKey = keys?.find((key) => String(key.user_id) === String(senderId));
    if (!senderKey && senderId) {
      try {
        senderKey = await fetchAndCachePublicKey(conversationId, senderId);
      } catch (error) {
        console.warn(`[Crypto] Failed to fetch public key for sender ${senderId}:`, error);
      }
    }

    return senderKey || null;
  }, [conversationKeys, fetchAndCachePublicKey, loadConversationKeys]);

  const encryptForConversation = useCallback(async (conversationId, plaintext, peerUserId = null) => {
    if (!identity) throw new Error('Encryption identity is not ready');
    const peer = await getPeerKey(conversationId, peerUserId);
    if (!peer?.public_key) {
      throw new Error('Recipient encryption key is not available yet. Your message will be retried after they sign in.');
    }
    const aesKey = await deriveAesKey(identity.privateKey, peer.public_key);
    const ivBytes = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivBytes }, aesKey, encoder.encode(plaintext));
    return {
      encryptedContent: bytesToBase64(encrypted),
      iv: bytesToBase64(ivBytes),
      salt: bytesToBase64(crypto.getRandomValues(new Uint8Array(16)))
    };
  }, [getPeerKey, identity]);

  const decryptMessage = useCallback(async (conversationId, message, peerUserId = null) => {
    if (!identity) throw new Error('Encryption identity not initialized');
    if (!message?.encrypted_content) return '';

    try {
      const decryptKey = String(message.sender_id) === String(user?.id)
        ? await getPeerKey(conversationId, peerUserId)
        : await getSenderKey(conversationId, message.sender_id);
      if (!decryptKey?.public_key) {
        throw new Error(`Encryption key not available (senderId: ${message.sender_id})`);
      }

      const aesKey = await deriveAesKey(identity.privateKey, decryptKey.public_key);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToBytes(message.iv) },
        aesKey,
        base64ToBytes(message.encrypted_content)
      );
      return decoder.decode(decrypted);
    } catch (error) {
      const diagnostic = {
        conversationId,
        messageId: message?.id,
        senderId: message?.sender_id,
        identityReady: Boolean(identity),
        keysLoaded: Boolean(conversationKeys[conversationId]),
        keyCount: conversationKeys[conversationId]?.length || 0,
        hasSenderKey: Boolean(conversationKeys[conversationId]?.some((key) => String(key.user_id) === String(message?.sender_id))),
        errorMessage: error?.message,
        errorName: error?.name
      };
      console.error('[Decryption Error]', diagnostic);
      setLastCryptoError(error?.message || 'Message decryption failed');
      throw new Error(error?.message || 'Message decryption failed');
    }
  }, [conversationKeys, getPeerKey, getSenderKey, identity, user?.id]);

  const debugState = useMemo(() => ({
    identityReady: Boolean(identity),
    userId: user?.id || null,
    fingerprint: identity?.fingerprint || null,
    conversations: Object.fromEntries(
      Object.entries(conversationKeys).map(([conversationId, keys]) => [
        conversationId,
        keys.map((key) => ({ userId: key.user_id, fingerprint: key.key_fingerprint, hasPublicKey: Boolean(key.public_key) }))
      ])
    ),
    lastCryptoError
  }), [conversationKeys, identity, lastCryptoError, user?.id]);

  const value = useMemo(() => ({
    identity,
    conversationKeys,
    lastCryptoError,
    debugState,
    publishKey,
    waitForIdentityReady,
    loadConversationKeys,
    fetchAndCachePublicKey,
    getPeerKey,
    encryptForConversation,
    decryptMessage
  }), [conversationKeys, debugState, decryptMessage, encryptForConversation, fetchAndCachePublicKey, getPeerKey, identity, lastCryptoError, loadConversationKeys, publishKey, waitForIdentityReady]);

  return <CryptoContext.Provider value={value}>{children}</CryptoContext.Provider>;
}
