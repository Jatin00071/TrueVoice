import { useEffect, useRef, useState } from 'react';
import MessageBubble from './MessageBubble.jsx';
import MessageInput from './MessageInput.jsx';
import TypingIndicator from './TypingIndicator.jsx';
import EncryptionIndicator from './EncryptionIndicator.jsx';
import InfoPanel from './InfoPanel.jsx';
import { useCrypto } from '../../hooks/useCrypto.js';
import styles from './Messages.module.css';

function PhoneIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.7 19.7 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.7 19.7 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.5 2.1L8 9.5a16 16 0 0 0 6.5 6.5l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.6.5 2.5.6A2 2 0 0 1 22 16.9Z" /></svg>;
}
function VideoIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M15 10.5 21 7v10l-6-3.5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3.5Z" /></svg>;
}
function InfoIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 10v6M12 7h.01" /></svg>;
}
function MoreIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>;
}
function InboxIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4.5 6.5h15v10h-9L6.5 20v-3.5h-2v-10Z" /><path d="M8 10h8M8 13h5" /></svg>;
}

function getInitial(name) {
  return (name?.trim()?.[0] || 'U').toUpperCase();
}

function ChatWindow({ conversation, messages, currentUserId, typing, onSend, onDeleteMessage, onUnsendMessage, onRetryMessage, pendingCount = 0 }) {
  const bottomRef = useRef(null);
  const { identity } = useCrypto();
  const [showInfo, setShowInfo] = useState(false);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!conversation) {
    return (
      <main className={styles.placeholder} aria-live="polite">
        <div className={styles.placeholderIcon}><InboxIcon /></div>
        <h2>Your encrypted inbox</h2>
        <p>Select a conversation or start one from a user profile.</p>
        <EncryptionIndicator variant="shield" />
      </main>
    );
  }

  const displayName = conversation.other_display_name || conversation.other_username || 'Conversation';

  return (
    <main className={styles.window} aria-label={`Conversation with ${displayName}`}>
      <header className={styles.chatHeader}>
        <div className={styles.chatIdentity}>
          <span className={styles.headerAvatar} aria-hidden="true">{getInitial(displayName)}</span>
          <div>
            <h2>{displayName}</h2>
            <p>Encrypted - Last seen recently</p>
          </div>
        </div>
        <div className={styles.chatActions} aria-label="Conversation actions">
          <button type="button" className={styles.disabledAction} aria-label="Voice calls coming soon" title="Voice calls coming soon" disabled><PhoneIcon /></button>
          <button type="button" className={styles.disabledAction} aria-label="Video calls coming soon" title="Video calls coming soon" disabled><VideoIcon /></button>
          <button type="button" className={showInfo ? styles.activeAction : ''} aria-label="View conversation info" title="Conversation details" onClick={() => setShowInfo(true)}><InfoIcon /></button>
          <div className={styles.moreWrap}>
            <button type="button" aria-label="More options" title="More options" onClick={() => setShowMore((value) => !value)}><MoreIcon /></button>
            {showMore ? (
              <div className={styles.moreMenu} role="menu">
                <button type="button" role="menuitem">View Encryption Details</button>
                <button type="button" role="menuitem">Conversation Settings</button>
                <button type="button" role="menuitem">Pin Conversation</button>
                <button type="button" role="menuitem">Mute Notifications</button>
                <button type="button" role="menuitem">Block User</button>
                <button type="button" role="menuitem">Report Conversation</button>
                <button type="button" role="menuitem">Archive Conversation</button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className={styles.messages} role="log" aria-live="polite" aria-relevant="additions">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            mine={String(message.sender_id) === String(currentUserId)}
            currentUserId={currentUserId}
            onDelete={onDeleteMessage}
            onUnsend={onUnsendMessage}
            onRetry={onRetryMessage}
          />
        ))}
        <TypingIndicator typing={typing} />
        <div ref={bottomRef} />
      </div>

      <MessageInput onSend={onSend} disabled={!conversation} conversationId={conversation?.id} pendingCount={pendingCount} />
      {showInfo ? (
        <InfoPanel
          conversation={conversation}
          myFingerprint={identity?.fingerprint}
          onClose={() => setShowInfo(false)}
        />
      ) : null}
    </main>
  );
}

export default ChatWindow;
