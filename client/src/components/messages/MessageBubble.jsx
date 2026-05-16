import AttachmentList from './AttachmentList.jsx';
import ReadReceipt from './ReadReceipt.jsx';
import styles from './Messages.module.css';

function MessageBubble({ message, mine }) {
  return <article className={`${styles.bubbleRow} ${mine ? styles.mine : ''}`}><div className={styles.bubble}><p>{message.decryptedContent || '[Encrypted]'}</p><AttachmentList attachments={message.attachments || []} /><footer><time>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>{message.is_edited ? <span>Edited</span> : null}<ReadReceipt read={Boolean(message.is_read)} mine={mine} /></footer></div></article>;
}
export default MessageBubble;
