import AttachmentList from './AttachmentList.jsx';
import ReadReceipt from './ReadReceipt.jsx';
import styles from './Messages.module.css';

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({ message, mine }) {
  const failed = Boolean(message.decryptionError);
  const displayText = failed
    ? `Decryption failed: ${message.decryptionError}`
    : message.decryptedContent || (message.encrypted_content ? '[Encrypted]' : '');

  return (
    <article className={`${styles.bubbleRow} ${mine ? styles.mine : ''} ${failed ? styles.failedBubbleRow : ''}`.trim()}>
      <div className={`${styles.bubble} ${failed ? styles.failedBubble : ''}`} title={failed ? message.decryptionError : undefined}>
        <p>{failed ? `? ${displayText}` : displayText}</p>
        <AttachmentList attachments={message.attachments || []} />
        <footer>
          <time>{formatTime(message.created_at)}</time>
          {message.is_edited ? <span>Edited</span> : null}
          <ReadReceipt read={Boolean(message.is_read)} mine={mine} />
        </footer>
      </div>
    </article>
  );
}

export default MessageBubble;
