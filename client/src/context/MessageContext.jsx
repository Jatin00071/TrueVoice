import { useCallback, useEffect, useMemo, useState } from 'react';
import { getConversations } from '../api/conversationApi.js';
import { getMessages, markMessageRead, sendMessage } from '../api/messageApi.js';
import { useSocketContext } from '../hooks/useSocket.js';
import { useCrypto } from '../hooks/useCrypto.js';
import { useAuthContext } from '../hooks/useAuth.js';
import { MessageContext } from './messageStore.js';

export function MessageProvider({ children }) {
  const { user } = useAuthContext();
  const { socket } = useSocketContext() || {};
  const cryptoContext = useCrypto();
  const [conversations, setConversations] = useState([]);
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [typingByConversation, setTypingByConversation] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const loadConversations = useCallback(async () => {
    if (!user) return [];
    const data = await getConversations();
    const items = data.items || [];
    setConversations(items);
    return items;
  }, [user]);

  const loadMessages = useCallback(async (conversationId, params = {}) => {
    if (!conversationId) return [];
    setIsLoading(true);
    try {
      await cryptoContext.publishKey(conversationId);
      await cryptoContext.loadConversationKeys(conversationId);
      const data = await getMessages(conversationId, { page: 1, limit: 50, ...params });
      const decrypted = await Promise.all((data.items || []).reverse().map(async (message) => ({
        ...message,
        decryptedContent: await cryptoContext.decryptMessage(conversationId, message)
      })));
      setMessagesByConversation((current) => ({ ...current, [conversationId]: decrypted }));
      return decrypted;
    } finally {
      setIsLoading(false);
    }
  }, [cryptoContext]);

  const sendEncryptedMessage = useCallback(async ({ conversationId, text }) => {
    const envelope = await cryptoContext.encryptForConversation(conversationId, text);
    const data = await sendMessage({ conversationId, ...envelope });
    const message = { ...data.message, decryptedContent: text };
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
      const decryptedContent = await cryptoContext.decryptMessage(conversationId, message);
      setMessagesByConversation((current) => ({ ...current, [conversationId]: [...(current[conversationId] || []), { ...message, decryptedContent }] }));
      void loadConversations();
    };
    const handleTyping = (payload) => setTypingByConversation((current) => ({ ...current, [payload.conversationId]: payload }));
    const handleDeleted = (payload) => setMessagesByConversation((current) => ({
      ...current,
      [payload.conversation_id || payload.conversationId]: (current[payload.conversation_id || payload.conversationId] || []).filter((message) => String(message.id) !== String(payload.id || payload.messageId))
    }));
    socket.on('message:new', handleNew);
    socket.on('message:typing', handleTyping);
    socket.on('message:deleted', handleDeleted);
    return () => {
      socket.off('message:new', handleNew);
      socket.off('message:typing', handleTyping);
      socket.off('message:deleted', handleDeleted);
    };
  }, [cryptoContext, loadConversations, socket]);

  const unreadCount = conversations.reduce((sum, item) => sum + Number(item.unread_count || 0), 0);
  const value = useMemo(() => ({ conversations, messagesByConversation, activeConversationId, setActiveConversationId, typingByConversation, unreadCount, isLoading, loadConversations, loadMessages, sendEncryptedMessage, markRead }), [activeConversationId, conversations, isLoading, loadConversations, loadMessages, markRead, messagesByConversation, sendEncryptedMessage, typingByConversation, unreadCount]);
  return <MessageContext.Provider value={value}>{children}</MessageContext.Provider>;
}
