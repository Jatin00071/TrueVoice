import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble.jsx';
import MessageInput from './MessageInput.jsx';
import TypingIndicator from './TypingIndicator.jsx';
import EncryptionIndicator from './EncryptionIndicator.jsx';
import styles from './Messages.module.css';

function ChatWindow({ conversation, messages, currentUserId, typing, onSend }) {
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);
  if (!conversation) return <div className={styles.placeholder}><h2>Your encrypted inbox</h2><p>Select a conversation or start one from a user profile.</p><EncryptionIndicator /></div>;
  return <div className={styles.window}><header className={styles.chatHeader}><div><h2>{conversation.other_display_name || conversation.other_username || 'Conversation'}</h2><p>End-to-end encrypted direct messages</p></div><EncryptionIndicator /></header><div className={styles.messages}>{messages.map((message) => <MessageBubble key={message.id} message={message} mine={String(message.sender_id) === String(currentUserId)} />)}<TypingIndicator typing={typing} /><div ref={bottomRef} /></div><MessageInput onSend={onSend} disabled={!conversation} /></div>;
}
export default ChatWindow;
