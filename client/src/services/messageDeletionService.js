import { deleteMessage as deleteMessageApi, unsendMessage as unsendMessageApi } from '../api/messageApi.js';

const UNSEND_WINDOW_MS = 15 * 60 * 1000;

export function canDelete(message) {
  return Boolean(message?.id && !String(message.id).startsWith('local:') && !String(message.id).startsWith('queue:') && !message.unsent_at);
}

export function canUnsend(message, currentUserId) {
  if (!canDelete(message) || String(message.sender_id) !== String(currentUserId)) return false;
  return Date.now() < getUnsendAvailableUntil(message.created_at).getTime();
}

export function getUnsendAvailableUntil(createdAt) {
  return new Date(new Date(createdAt).getTime() + UNSEND_WINDOW_MS);
}

export async function deleteMessage(messageId, type = 'soft') {
  return deleteMessageApi(messageId, type);
}

export async function unsendMessage(messageId) {
  return unsendMessageApi(messageId);
}

export function handleMessageDeleted(message, type) {
  if (type === 'hard') return { ...message, is_hidden: true };
  return { ...message, deleted_at: message.deleted_at || new Date().toISOString() };
}
