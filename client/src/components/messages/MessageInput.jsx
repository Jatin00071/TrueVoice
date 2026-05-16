import { useState } from 'react';
import FileUploadArea from './FileUploadArea.jsx';
import styles from './Messages.module.css';

function SendIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4 20-7Z" /><path d="M22 2 11 13" /></svg>;
}

function MessageInput({ onSend, disabled }) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || disabled || isSending) return;
    setIsSending(true);
    try {
      await onSend(value);
      setText('');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form className={styles.inputArea} onSubmit={submit} aria-label="Send encrypted message">
      <div className={styles.composerRow}>
        <FileUploadArea disabled={disabled} />
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Type a message..."
          disabled={disabled || isSending}
          rows={1}
          aria-label="Message text"
        />
        <button className={styles.sendButton} type="submit" disabled={disabled || isSending || !text.trim()} aria-label="Send message">
          <SendIcon />
        </button>
      </div>
      <p className={styles.encryptionNote}><span aria-hidden="true">??</span> Messages are end-to-end encrypted</p>
    </form>
  );
}

export default MessageInput;
