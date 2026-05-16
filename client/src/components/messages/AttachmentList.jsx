import { attachmentDownloadUrl } from '../../api/mediaApi.js';
import styles from './Messages.module.css';
function AttachmentList({ attachments = [] }) { const clean = attachments.filter(Boolean); if (!clean.length) return null; return <div className={styles.attachments}>{clean.map((item) => <a key={item.id} href={attachmentDownloadUrl(item.id)} target="_blank" rel="noreferrer">{item.file_name || 'Encrypted attachment'}</a>)}</div>; }
export default AttachmentList;
