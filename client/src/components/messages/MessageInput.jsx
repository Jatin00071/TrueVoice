import { useState } from 'react';
import FileUploadArea from './FileUploadArea.jsx';
import styles from './Messages.module.css';

function MessageInput({ onSend, disabled }) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || disabled || isSending) return;
    setIsSending(true);
    try { await onSend(value); setText(''); } finally { setIsSending(false); }
  };
  return <form className={styles.inputBar} onSubmit={submit}><FileUploadArea disabled={disabled} /><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write an encrypted message" disabled={disabled || isSending} /><button type="submit" disabled={disabled || isSending || !text.trim()}>Send</button></form>;
}
export default MessageInput;
