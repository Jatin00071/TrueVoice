import { useState } from 'react';
import AttachmentList from './AttachmentList.jsx';
import ReadReceipt from './ReadReceipt.jsx';
import MessageActionDialog from '../modals/MessageActionDialog.jsx';
import { canDelete, canUnsend, getUnsendAvailableUntil } from '../../services/messageDeletionService.js';
import styles from './Messages.module.css';

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function TrashIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" /></svg>;
}

function UndoIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 1 1 0 10h-4" /></svg>;
}

function RetryIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></svg>;
}

function MoreIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>;
}

function statusText(message, mine) {
  if (message.deleted_at) return null;
  if (message.status === 'pending') return 'Sending...';
  if (message.status === 'failed') return 'Not delivered';
  if (!mine) return null;
  if (message.is_read) return 'Read';
  if (message.status === 'delivered') return 'Delivered';
  return 'Sent';
}

function MessageBubble({ message, mine, currentUserId, onDelete, onUnsend, onRetry }) {
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const failed = Boolean(message.decryptionError);
  if (message.unsent_at || message.is_hidden) return null;
  const deleted = Boolean(message.deleted_at);
  const displayText = failed
    ? `Decryption failed: ${message.decryptionError}`
    : deleted
      ? '[deleted message]'
      : message.decryptedContent || (message.encrypted_content ? '[Encrypted]' : '');
  const status = statusText(message, mine);
  const deleteType = mine ? 'soft' : 'hard';
  const canShowDelete = canDelete(message);
  const canShowUnsend = canUnsend(message, currentUserId);

  const confirm = async () => {
    setBusy(true);
    try {
      if (dialog === 'delete') await onDelete?.(message.id, deleteType);
      if (dialog === 'unsend') await onUnsend?.(message.id);
      setDialog(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`${styles.bubbleRow} ${mine ? styles.mine : ''} ${failed ? styles.failedBubbleRow : ''}`.trim()}>
      <div className={`${styles.bubble} ${failed ? styles.failedBubble : ''} ${deleted ? styles.deletedBubble : ''} ${message.status === 'pending' ? styles.pendingBubble : ''}`.trim()} title={failed ? message.decryptionError : undefined}>
        {!deleted ? (
          <div className={styles.messageActions} aria-label="Message actions">
            {canShowDelete ? <button type="button" className={styles.deleteAction} title="Delete message" aria-label="Delete message" onClick={() => setDialog('delete')}><TrashIcon /></button> : null}
            {canShowUnsend ? (
              <button
                type="button"
                className={styles.unsendAction}
                title={`Unsend available until ${formatTime(getUnsendAvailableUntil(message.created_at))}`}
                aria-label="Unsend message"
                onClick={() => setDialog('unsend')}
              >
                <UndoIcon />
              </button>
            ) : null}
            <button type="button" title="Message options" aria-label="More message options" disabled><MoreIcon /></button>
          </div>
        ) : null}
        <p>{displayText}</p>
        <AttachmentList attachments={message.attachments || []} />
        <footer>
          <time>{formatTime(message.created_at)}</time>
          {message.is_edited ? <span>Edited</span> : null}
          {status ? <span className={`${styles.messageStatus} ${message.status === 'failed' ? styles.statusFailed : ''} ${message.is_read ? styles.statusRead : ''}`.trim()}>{status}</span> : null}
          {message.status === 'failed' ? <button type="button" className={styles.retryButton} onClick={() => onRetry?.(message)}>Retry</button> : null}
          {message.status !== 'pending' && message.status !== 'failed' && !deleted ? <ReadReceipt read={Boolean(message.is_read)} mine={mine} /> : null}
        </footer>
      </div>
      <MessageActionDialog type={dialog} open={Boolean(dialog)} busy={busy} onCancel={() => setDialog(null)} onConfirm={confirm} />
    </article>
  );
}

export default MessageBubble;
