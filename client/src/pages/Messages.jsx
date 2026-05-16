import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import MessagesLayout from '../components/messages/MessagesLayout.jsx';
import ConversationList from '../components/messages/ConversationList.jsx';
import ChatWindow from '../components/messages/ChatWindow.jsx';
import MessageSearch from '../components/messages/MessageSearch.jsx';
import { startConversation } from '../api/conversationApi.js';
import { useAuthContext } from '../hooks/useAuth.js';
import { useMessages } from '../hooks/useMessages.js';
import styles from './Messages.module.css';

function Messages() {
  const { user } = useAuthContext();
  const messages = useMessages();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversationFilter, setConversationFilter] = useState('');
  const [messageFilter, setMessageFilter] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const userId = searchParams.get('user');
    if (!userId) return;
    let cancelled = false;
    async function start() {
      try {
        const result = await startConversation(userId);
        if (cancelled) return;
        const conversation = result.conversation;
        await messages.loadConversations();
        messages.setActiveConversationId(conversation.id);
        await messages.loadMessages(conversation.id);
        setSearchParams({ conversation: String(conversation.id) }, { replace: true });
      } catch (err) {
        setError(err?.response?.data?.message || err.message || 'Unable to start conversation.');
      }
    }
    void start();
    return () => { cancelled = true; };
  }, [messages, searchParams, setSearchParams]);

  useEffect(() => {
    const conversationId = searchParams.get('conversation');
    if (conversationId && conversationId !== String(messages.activeConversationId || '')) {
      messages.setActiveConversationId(Number(conversationId));
      void messages.loadMessages(Number(conversationId));
    }
  }, [messages, searchParams]);

  const activeConversation = useMemo(() => messages.conversations.find((item) => String(item.id) === String(messages.activeConversationId)), [messages.activeConversationId, messages.conversations]);
  const activeMessages = messages.messagesByConversation[messages.activeConversationId] || [];
  const visibleMessages = activeMessages.filter((message) => !messageFilter.trim() || message.decryptedContent?.toLowerCase().includes(messageFilter.trim().toLowerCase()));

  const selectConversation = async (conversation) => {
    messages.setActiveConversationId(conversation.id);
    setSearchParams({ conversation: String(conversation.id) });
    await messages.loadMessages(conversation.id);
  };

  const send = async (text) => {
    if (!messages.activeConversationId) return;
    await messages.sendEncryptedMessage({ conversationId: messages.activeConversationId, text });
  };

  return <section className={styles.page}><div className={styles.header}><div><h1>Messages</h1><p>Private, end-to-end encrypted conversations.</p></div><MessageSearch value={messageFilter} onChange={setMessageFilter} /></div>{error ? <p className={styles.error}>{error}</p> : null}<MessagesLayout sidebar={<ConversationList conversations={messages.conversations} activeId={messages.activeConversationId} onSelect={selectConversation} filter={conversationFilter} onFilterChange={setConversationFilter} />}><ChatWindow conversation={activeConversation} messages={visibleMessages} currentUserId={user?.id} typing={messages.typingByConversation[messages.activeConversationId]} onSend={send} /></MessagesLayout></section>;
}
export default Messages;
