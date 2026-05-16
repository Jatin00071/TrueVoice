import styles from './Messages.module.css';
function ReadReceipt({ read, mine }) {
  if (!mine) return null;
  return <span className={read ? styles.read : styles.delivered} aria-label={read ? 'Read' : 'Sent'}>{read ? 'Read' : 'Sent'}</span>;
}
export default ReadReceipt;
