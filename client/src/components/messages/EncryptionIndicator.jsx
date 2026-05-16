import styles from './Messages.module.css';

function EncryptionIndicator() {
  return <span className={styles.encryption}>?? E2EE</span>;
}
export default EncryptionIndicator;
