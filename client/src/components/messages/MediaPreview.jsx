import styles from './Messages.module.css';

function MediaPreview({ file, onRemove }) {
  if (!file) return null;
  return <div className={styles.mediaPreview}><span>{file.name}</span><small>{Math.round(file.size / 1024)} KB</small>{onRemove ? <button type="button" onClick={onRemove}>Remove</button> : null}</div>;
}
export default MediaPreview;
