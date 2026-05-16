import styles from './Messages.module.css';
function MessageSearch({ value, onChange }) { return <input className={styles.search} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search decrypted messages" />; }
export default MessageSearch;
