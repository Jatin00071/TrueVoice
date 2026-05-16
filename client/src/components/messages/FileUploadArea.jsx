import styles from './Messages.module.css';

function PaperclipIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m21.4 11.6-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 1 1-2.8-2.8l8.5-8.5" /></svg>;
}

function FileUploadArea({ disabled }) {
  return (
    <label className={`${styles.fileButton} ${disabled ? styles.disabled : ''}`} title="Attach encrypted media">
      <input type="file" disabled={disabled} aria-label="Attach encrypted media" />
      <PaperclipIcon />
    </label>
  );
}

export default FileUploadArea;
