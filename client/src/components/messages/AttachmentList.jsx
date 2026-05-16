import { attachmentDownloadUrl } from '../../api/mediaApi.js';
import styles from './Messages.module.css';

function FileIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></svg>;
}

function formatBytes(value) {
  const size = Number(value || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentList({ attachments = [] }) {
  const clean = attachments.filter(Boolean);
  if (!clean.length) return null;

  return (
    <div className={styles.attachments}>
      {clean.map((item) => (
        <a key={item.id} href={attachmentDownloadUrl(item.id)} target="_blank" rel="noreferrer">
          <span><FileIcon /></span>
          <span><strong>{item.file_name || 'Encrypted attachment'}</strong><small>{formatBytes(item.file_size)}</small></span>
        </a>
      ))}
    </div>
  );
}

export default AttachmentList;
