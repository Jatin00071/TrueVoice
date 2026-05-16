import styles from './Messages.module.css';

function FileUploadArea({ disabled }) {
  return <label className={`${styles.fileButton} ${disabled ? styles.disabled : ''}`} title="Encrypted media upload"><input type="file" disabled={disabled} aria-label="Attach encrypted media" />?</label>;
}
export default FileUploadArea;
