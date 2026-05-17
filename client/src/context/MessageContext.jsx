import { useCallback, useEffect, useMemo, useState } from 'react';
import { getConversations } from '../api/conversationApi.js';
import { getMessages, markMessageRead, sendMessage } from '../api/messageApi.js';
import { useSocketContext } from '../hooks/useSocket.js';
import { useCrypto } from '../hooks/useCrypto.js';
import { useAuthContext } from '../hooks/useAuth.js';
import { MessageContext } from './messageStore.js';
import * as queueService from '../services/messageQueueService.js';
import * as deliveryService from '../services/messageDeliveryService.js';
import * as deletionService from '../services/messageDeletionService.js';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function otherUserIdForConversation(conversation, currentUserId) {
  if (!conversation) return null;
  return conversation.other_user_id
    || (String(conversation.user_1_id) === String(currentUserId) ? conversation.user_2_id : conversation.user_1_id);
}

async function waitForIdentity(cryptoContext, timeoutMs = 2000) {
  if (cryptoContext?.waitForIdentityReady) {
    await cryptoContext.waitForIdentityReady(timeoutMs);
    return;
  }

  const started = Date.now();
  while (!cryptoContext?.identity && Date.now() - started < timeoutMs) {
    await wait(100);
  }
  if (!cryptoContext?.identity) {
    throw new Error('Encryption identity failed to initialize');
  }
}

async function withTimeout(promise, timeoutMs, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = window.setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
      })
    ]);
  } finally {
    window.clearTimeout(timer);
  }
}

export function MessageProvider({ children }) {
  const { user } = useAuthContext();
  const { socket } = useSocketContext() || {};
  const cryptoContext = useCrypto();
  const [conversations, setConversations] = useState([]);
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [typingByConversation, setTypingByConversation] = useState({});
  const [decryptionFailures, setDecryptionFailures] = useState({});
  const [messageQueue, setMessageQueue] = useState({});
  const [deliveryStatus, setDeliveryStatus] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const refreshLocalQueue = useCallback(async () => {
    try {
      const all = await queueService.getAll();
      const grouped = all.reduce((acc, item) => {
        const key = String(item.conversationId);
        acc[key] = [...(acc[key] || []), item];
        return acc;
      }, {});
      setMessageQueue(grouped);
      setDeliveryStatus(Object.fromEntries(all.map((item) => [item.id, {
        status: item.status,
        retries: item.retryCount || 0,
        lastRetry: item.lastRetryAt || null
      }])));
      return grouped;
    } catch (error) {
      console.warn('[Messages] Failed to load local message queue:', error);
      return {};
    }
  }, []);

  const loadConversations = useCallback(async () => {
    if (!user) return [];
    const data = await getConversations();
    const items = data.items || [];
    setConversations(items);
    return items;
  }, [user]);

  const getConversationPeerId = useCallback((conversationId) => {
    const conversation = conversations.find((item) => String(item.id) === String(conversationId));
    return otherUserIdForConversation(conversation, user?.id);
  }, [conversations, user?.id]);

  const decryptOneMessage = useCallback(async (conversationId, message) => {
    if (message?.deleted_at || message?.unsent_at) {
      return { ...message, decryptedContent: '', decryptionError: null };
    }
    try {
      const decryptedContent = await cryptoContext.decryptMessage(conversationId, message, getConversationPeerId(conversationId));
      return { ...message, decryptedContent, decryptionError: null };
    } catch (error) {
      const messageText = error?.message || 'Message decryption failed';
      console.error(`[Messages] Failed to decrypt message ${message.id}:`, error);
      return {
        ...message,
        decryptedContent: '',
        decryptionError: messageText
      };
    }
  }, [cryptoContext, getConversationPeerId]);

  const markConversationAsRead = useCallback(async (conversationId, messages) => {
    if (!conversationId || !Array.isArray(messages) || messages.length === 0) return;
    const unreadMessages = messages.filter((message) =>
      message && message.id && String(message.sender_id) !== String(user?.id) && !message.is_read
    );
    if (!unreadMessages.length) return;
    await Promise.all(unreadMessages.map((message) =>
      markMessageRead(message.id).catch((error) => {
        console.warn('[Messages] Failed to mark message read:', message.id, error);
      })
    ));
  }, [user?.id]);

  const loadMessages = useCallback(async (conversationId, params = {}) => {
    if (!conversationId) return [];
    setIsLoading(true);

    try {
      await waitForIdentity(cryptoContext, 2000);

      try {
        await cryptoContext.publishKey(conversationId);
      } catch (error) {
        console.warn('[Messages] Failed to publish encryption key; continuing:', error);
      }

      try {
        await withTimeout(cryptoContext.loadConversationKeys(conversationId), 5000, 'Encryption key loading');
      } catch (error) {
        console.warn('[Messages] Failed to load conversation keys before message fetch:', error);
      }

      const data = await getMessages(conversationId, { page: 1, limit: 50, includeDeleted: true, ...params });
      const decrypted = await Promise.all((data.items || []).reverse().map((message) => decryptOneMessage(conversationId, message)));
      const localPending = (await queueService.getPendingByConversation(conversationId)).map((item) => ({
        ...item,
        id: item.id,
        conversation_id: conversationId,
        sender_id: user?.id,
        decryptedContent: item.text,
        status: item.status
      }));

      const failures = decrypted.filter((message) => message.decryptionError);
      setDecryptionFailures((current) => ({ ...current, [conversationId]: failures.map((message) => ({ id: message.id, error: message.decryptionError })) }));
      setMessagesByConversation((current) => ({ ...current, [conversationId]: [...decrypted, ...localPending] }));
      await markConversationAsRead(conversationId, decrypted);
      await loadConversations();
      await refreshLocalQueue();
      return [...decrypted, ...localPending];
    } catch (error) {
      console.error('[Messages] Failed to load messages:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [cryptoContext, decryptOneMessage, loadConversations, markConversationAsRead, refreshLocalQueue, user?.id]);

  const queueMessage = useCallback(async (conversationId, payload) => {
    const queued = await queueService.addToQueue(conversationId, payload);
    setMessagesByConversation((current) => ({
      ...current,
      [conversationId]: [...(current[conversationId] || []), {
        ...queued,
        conversation_id: conversationId,
        sender_id: user?.id,
        decryptedContent: queued.text,
        status: queued.status
      }]
    }));
    setMessageQueue((current) => ({ ...current, [conversationId]: [...(current[conversationId] || []), queued] }));
    setDeliveryStatus((current) => ({ ...current, [queued.id]: { status: 'pending', retries: 0, lastRetry: null } }));
    socket?.emit('message:queued', { conversationId, messageId: queued.id });
    return queued;
  }, [socket, user?.id]);

  const sendQueuedItem = useCallback(async (item) => {
    const envelope = item.encryptedPayload || await cryptoContext.encryptForConversation(item.conversationId, item.text, item.peerUserId || getConversationPeerId(item.conversationId));
    const data = await sendMessage({ conversationId: item.conversationId, ...envelope });
    const sent = { ...data.message, decryptedContent: item.text, decryptionError: null, status: data.message?.status || 'sent' };
    setMessagesByConversation((current) => ({
      ...current,
      [item.conversationId]: (current[item.conversationId] || []).map((message) => String(message.id) === String(item.id) ? sent : message)
    }));
    setDeliveryStatus((current) => ({ ...current, [item.id]: { status: 'sent', retries: Number(item.retryCount || 0), lastRetry: new Date().toISOString() } }));
    await queueService.markSent(item.id);
    await refreshLocalQueue();
    await loadConversations();
    return sent;
  }, [cryptoContext, getConversationPeerId, loadConversations, refreshLocalQueue]);

  const retryPendingMessages = useCallback(async (conversationId) => {
    const items = (await queueService.getAll()).filter((item) => (
      String(item.conversationId) === String(conversationId) && ['pending', 'failed'].includes(item.status)
    ));
    await Promise.all(items.map((item) => sendQueuedItem(item).catch(async (error) => {
      await queueService.markFailed(item.id, error);
      setDeliveryStatus((current) => ({
        ...current,
        [item.id]: { status: 'failed', retries: Number(item.retryCount || 0) + 1, lastRetry: new Date().toISOString() }
      }));
      setMessagesByConversation((current) => ({
        ...current,
        [conversationId]: (current[conversationId] || []).map((message) => (
          String(message.id) === String(item.id)
            ? { ...message, status: Number(item.retryCount || 0) + 1 >= 10 ? 'failed' : 'pending', error: error.message }
            : message
        ))
      }));
    })));
    await refreshLocalQueue();
  }, [refreshLocalQueue, sendQueuedItem]);

  const sendEncryptedMessage = useCallback(async ({ conversationId, text }) => {
    await waitForIdentity(cryptoContext, 2000);
    try {
      const peerUserId = getConversationPeerId(conversationId);
      const envelope = await cryptoContext.encryptForConversation(conversationId, text, peerUserId);
      const data = await sendMessage({ conversationId, ...envelope });
      const message = { ...data.message, decryptedContent: text, decryptionError: null, status: data.message?.status || 'sent' };
      setMessagesByConversation((current) => ({ ...current, [conversationId]: [...(current[conversationId] || []), message] }));
      await loadConversations();
      return message;
    } catch (error) {
      const queued = await queueMessage(conversationId, {
        text,
        peerUserId: getConversationPeerId(conversationId),
        error: error.message,
        maxRetries: 10
      });
      deliveryService.startMonitoring(conversationId, async (item) => {
        try {
          return await sendQueuedItem(item);
        } catch (retryError) {
          setDeliveryStatus((current) => ({
            ...current,
            [item.id]: { status: 'failed', retries: Number(item.retryCount || 0) + 1, lastRetry: new Date().toISOString() }
          }));
          setMessagesByConversation((current) => ({
            ...current,
            [conversationId]: (current[conversationId] || []).map((message) => (
              String(message.id) === String(item.id)
                ? { ...message, status: Number(item.retryCount || 0) + 1 >= 10 ? 'failed' : 'pending', error: retryError.message }
                : message
            ))
          }));
          throw retryError;
        }
      });
      return queued;
    }
  }, [cryptoContext, getConversationPeerId, loadConversations, queueMessage, sendQueuedItem]);

  const deleteMessage = useCallback(async (messageId, type = 'soft') => {
    const result = await deletionService.deleteMessage(messageId, type);
    const conversationId = result.message?.conversation_id;
    setMessagesByConversation((current) => {
      const next = { ...current };
      Object.keys(next).forEach((key) => {
        next[key] = next[key].map((message) => (
          String(message.id) === String(messageId)
            ? deletionService.handleMessageDeleted({ ...message, deleted_at: result.message?.deleted_at }, result.type)
            : message
        )).filter((message) => !message.is_hidden);
      });
      return next;
    });
    if (conversationId) await loadConversations();
    return result;
  }, [loadConversations]);

  const unsendMessage = useCallback(async (messageId) => {
    const result = await deletionService.unsendMessage(messageId);
    setMessagesByConversation((current) => {
      const next = {};
      Object.keys(current).forEach((key) => {
        next[key] = current[key].filter((message) => String(message.id) !== String(messageId));
      });
      return next;
    });
    await loadConversations();
    return result;
  }, [loadConversations]);

  const getQueuedCount = useCallback((conversationId = null) => {
    if (conversationId) return (messageQueue[String(conversationId)] || []).filter((item) => item.status === 'pending').length;
    return Object.values(messageQueue).flat().filter((item) => item.status === 'pending').length;
  }, [messageQueue]);

  const markRead = useCallback(async (messageId) => markMessageRead(messageId), []);

  useEffect(() => {
    void loadConversations();
    void refreshLocalQueue();
  }, [loadConversations, refreshLocalQueue]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleNew = async (message) => {
      const conversationId = message.conversation_id;
      const decrypted = await decryptOneMessage(conversationId, message);
      setMessagesByConversation((current) => ({ ...current, [conversationId]: [...(current[conversationId] || []), decrypted] }));
      if (decrypted.decryptionError) {
        setDecryptionFailures((current) => ({
          ...current,
          [conversationId]: [...(current[conversationId] || []), { id: message.id, error: decrypted.decryptionError }]
        }));
        window.dispatchEvent(new CustomEvent('tv:toast', { detail: { message: decrypted.decryptionError, tone: 'warning', duration: 6000 } }));
      }
      void loadConversations();
    };

    const handleKeysUpdated = (payload = {}) => {
      if (payload.conversationId && payload.userId && payload.publicKey) {
        cryptoContext.fetchAndCachePublicKey(payload.conversationId, payload.userId).catch((error) => {
          console.warn('[Messages] Failed to refresh updated key:', error);
        }).finally(() => {
          void retryPendingMessages(payload.conversationId);
          deliveryService.notifyKeyAvailable(payload.conversationId, sendQueuedItem).catch(() => {});
        });
      }
    };

    const handleStatus = (payload = {}) => {
      setDeliveryStatus((current) => ({ ...current, [payload.messageId]: { status: payload.status, lastRetry: payload.timestamp, retries: current[payload.messageId]?.retries || 0 } }));
    };

    const handleUnsent = (payload) => setMessagesByConversation((current) => ({
      ...current,
      [payload.conversation_id || payload.conversationId]: (current[payload.conversation_id || payload.conversationId] || []).filter((message) => String(message.id) !== String(payload.id || payload.messageId))
    }));

    const handleTyping = (payload) => setTypingByConversation((current) => ({ ...current, [payload.conversationId]: payload }));
    const handleDeleted = (payload) => setMessagesByConversation((current) => ({
      ...current,
      [payload.conversation_id || payload.conversationId]: (current[payload.conversation_id || payload.conversationId] || []).map((message) => (
        String(message.id) === String(payload.id || payload.messageId)
          ? { ...message, deleted_at: payload.deletedAt || new Date().toISOString() }
          : message
      ))
    }));
    const handleHidden = (payload) => setMessagesByConversation((current) => ({
      ...current,
      [payload.conversation_id || payload.conversationId]: (current[payload.conversation_id || payload.conversationId] || []).filter((message) => String(message.id) !== String(payload.id || payload.messageId))
    }));

    socket.on('message:new', handleNew);
    socket.on('message:status', handleStatus);
    socket.on('keys:updated', handleKeysUpdated);
    socket.on('message:retry-eligible', (payload) => payload?.conversationId && retryPendingMessages(payload.conversationId));
    socket.on('message:typing', handleTyping);
    socket.on('message:deleted', handleDeleted);
    socket.on('message:hidden', handleHidden);
    socket.on('message:unsent', handleUnsent);
    return () => {
      socket.off('message:new', handleNew);
      socket.off('message:status', handleStatus);
      socket.off('keys:updated', handleKeysUpdated);
      socket.off('message:retry-eligible');
      socket.off('message:typing', handleTyping);
      socket.off('message:deleted', handleDeleted);
      socket.off('message:hidden', handleHidden);
      socket.off('message:unsent', handleUnsent);
    };
  }, [cryptoContext, decryptOneMessage, loadConversations, retryPendingMessages, sendQueuedItem, socket]);

  const unreadCount = conversations.reduce((sum, item) => sum + Number(item.unread_count || 0), 0);
  const value = useMemo(() => ({
    conversations,
    messagesByConversation,
    activeConversationId,
    setActiveConversationId,
    typingByConversation,
    decryptionFailures,
    messageQueue,
    deliveryStatus,
    unreadCount,
    isLoading,
    loadConversations,
    loadMessages,
    sendEncryptedMessage,
    queueMessage,
    retryPendingMessages,
    getQueuedCount,
    deleteMessage,
    unsendMessage,
    markRead
  }), [activeConversationId, conversations, decryptionFailures, deleteMessage, deliveryStatus, getQueuedCount, isLoading, loadConversations, loadMessages, markRead, messageQueue, messagesByConversation, queueMessage, retryPendingMessages, sendEncryptedMessage, typingByConversation, unreadCount, unsendMessage]);

  return <MessageContext.Provider value={value}>{children}</MessageContext.Provider>;
}
