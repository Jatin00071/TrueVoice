import { getRetryable, markFailed, markSent, retryMessage } from './messageQueueService.js';

const monitors = new Map();

export function startMonitoring(conversationId, retryCallback) {
  stopMonitoring(conversationId);
  const timer = window.setInterval(async () => {
    const retryable = (await getRetryable()).filter((item) => String(item.conversationId) === String(conversationId));
    await Promise.all(retryable.map((item) => retryPendingMessage(item, retryCallback)));
  }, 2000);
  monitors.set(String(conversationId), timer);
}

export function stopMonitoring(conversationId) {
  const timer = monitors.get(String(conversationId));
  if (timer) window.clearInterval(timer);
  monitors.delete(String(conversationId));
}

export async function notifyKeyAvailable(conversationId, retryCallback) {
  const retryable = (await getRetryable()).filter((item) => String(item.conversationId) === String(conversationId));
  await Promise.all(retryable.map((item) => retryPendingMessage(item, retryCallback)));
}

export function getRetryCount(message) {
  return Number(message?.retryCount || message?.retries || 0);
}

export function estimateRetryEnd(message) {
  const remaining = Math.max(0, Number(message?.maxRetries || 10) - getRetryCount(message));
  return new Date(Date.now() + remaining * 2000);
}

async function retryPendingMessage(item, retryCallback) {
  try {
    await retryMessage(item.id);
    await retryCallback(item);
    await markSent(item.id);
  } catch (error) {
    await markFailed(item.id, error);
  }
}
