import { useEffect, useMemo, useState } from 'react';
import FileUploadArea from './FileUploadArea.jsx';
import styles from './Messages.module.css';

function SendIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4 20-7Z" /><path d="M22 2 11 13" /></svg>;
}

function MessageInput({ onSend, disabled, conversationId, pendingCount = 0 }) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const draftKey = useMemo(() => conversationId ? `tv:draft:${conversationId}` : null, [conversationId]);

  useEffect(() => {
    if (!draftKey) return;
    setText(window.localStorage.getItem(draftKey) || '');
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) return undefined;
    const timer = window.setTimeout(() => {
      if (text.trim()) window.localStorage.setItem(draftKey, text);
      else window.localStorage.removeItem(draftKey);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [draftKey, text]);

  const submit = async (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || disabled || isSending) return;
    setIsSending(true);
    try {
      await onSend(value);
      setText('');
      if (draftKey) window.localStorage.removeItem(draftKey);
    } finally {
      setIsSending(false);
    }
  };

  const onKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <form className={styles.inputArea} onSubmit={submit} aria-label="Send encrypted message">
      {pendingCount > 0 ? <p className={styles.pendingBanner}>You have {pendingCount} pending {pendingCount === 1 ? 'message' : 'messages'}</p> : null}
      <div className={styles.composerRow}>
        <FileUploadArea disabled={disabled} />
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message..."
          disabled={disabled || isSending}
          rows={1}
          aria-label="Message text"
        />
        <button className={styles.sendButton} type="submit" disabled={disabled || isSending || !text.trim()} aria-label="Send message">
          <SendIcon />
        </button>
      </div>
      <p className={styles.encryptionNote}><span aria-hidden="true">Lock</span> Messages are end-to-end encrypted</p>
    </form>
  );
}

export default MessageInput;
