import { useCallback, useEffect, useMemo, useState } from 'react';
import { getConversations } from '../api/conversationApi.js';
import { getMessages, markMessageRead, sendMessage } from '../api/messageApi.js';
import { useSocketContext } from '../hooks/useSocket.js';
import { useCrypto } from '../hooks/useCrypto.js';
import { useAuthContext } from '../hooks/useAuth.js';
import { MessageContext } from './messageStore.js';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const [isLoading, setIsLoading] = useState(false);

  const loadConversations = useCallback(async () => {
    if (!user) return [];
    const data = await getConversations();
    const items = data.items || [];
    setConversations(items);
    return items;
  }, [user]);

  const decryptOneMessage = useCallback(async (conversationId, message) => {
    try {
      const decryptedContent = await cryptoContext.decryptMessage(conversationId, message);
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
  }, [cryptoContext]);

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

      const data = await getMessages(conversationId, { page: 1, limit: 50, ...params });
      const decrypted = await Promise.all((data.items || []).reverse().map((message) => decryptOneMessage(conversationId, message)));

      const failures = decrypted.filter((message) => message.decryptionError);
      setDecryptionFailures((current) => ({ ...current, [conversationId]: failures.map((message) => ({ id: message.id, error: message.decryptionError })) }));
      setMessagesByConversation((current) => ({ ...current, [conversationId]: decrypted }));
      return decrypted;
    } catch (error) {
      console.error('[Messages] Failed to load messages:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [cryptoContext, decryptOneMessage]);

  const sendEncryptedMessage = useCallback(async ({ conversationId, text }) => {
    await waitForIdentity(cryptoContext, 2000);
    const envelope = await cryptoContext.encryptForConversation(conversationId, text);
    const data = await sendMessage({ conversationId, ...envelope });
    const message = { ...data.message, decryptedContent: text, decryptionError: null };
    setMessagesByConversation((current) => ({ ...current, [conversationId]: [...(current[conversationId] || []), message] }));
    await loadConversations();
    return message;
  }, [cryptoContext, loadConversations]);

  const markRead = useCallback(async (messageId) => markMessageRead(messageId), []);

  useEffect(() => { void loadConversations(); }, [loadConversations]);

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
        });
      }
    };

    const handleTyping = (payload) => setTypingByConversation((current) => ({ ...current, [payload.conversationId]: payload }));
    const handleDeleted = (payload) => setMessagesByConversation((current) => ({
      ...current,
      [payload.conversation_id || payload.conversationId]: (current[payload.conversation_id || payload.conversationId] || []).filter((message) => String(message.id) !== String(payload.id || payload.messageId))
    }));

    socket.on('message:new', handleNew);
    socket.on('keys:updated', handleKeysUpdated);
    socket.on('message:typing', handleTyping);
    socket.on('message:deleted', handleDeleted);
    return () => {
      socket.off('message:new', handleNew);
      socket.off('keys:updated', handleKeysUpdated);
      socket.off('message:typing', handleTyping);
      socket.off('message:deleted', handleDeleted);
    };
  }, [cryptoContext, decryptOneMessage, loadConversations, socket]);

  const unreadCount = conversations.reduce((sum, item) => sum + Number(item.unread_count || 0), 0);
  const value = useMemo(() => ({
    conversations,
    messagesByConversation,
    activeConversationId,
    setActiveConversationId,
    typingByConversation,
    decryptionFailures,
    unreadCount,
    isLoading,
    loadConversations,
    loadMessages,
    sendEncryptedMessage,
    markRead
  }), [activeConversationId, conversations, decryptionFailures, isLoading, loadConversations, loadMessages, markRead, messagesByConversation, sendEncryptedMessage, typingByConversation, unreadCount]);

  return <MessageContext.Provider value={value}>{children}</MessageContext.Provider>;
}
