import styles from '../messages/Messages.module.css';

const copy = {
  delete: {
    title: 'Delete message?',
    text: "The other person will see '[deleted message]'.",
    confirm: 'Delete',
    tone: 'danger'
  },
  delete_conversation: {
    title: 'Delete conversation?',
    text: 'This will hide the conversation from your inbox.',
    confirm: 'Delete',
    tone: 'danger'
  },
  unsend: {
    title: 'Unsend message?',
    text: 'This will remove the message from this conversation for both of you.',
    confirm: 'Unsend',
    tone: 'warning'
  },
  block: {
    title: 'Block user?',
    text: "They won't be able to message you.",
    confirm: 'Block',
    tone: 'danger'
  }
};

function MessageActionDialog({ type = 'delete', open, onCancel, onConfirm, busy = false }) {
  if (!open) return null;
  const content = copy[type] || copy.delete;

  return (
    <div className={styles.dialogBackdrop} role="presentation" onMouseDown={onCancel}>
      <section
        className={styles.actionDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-action-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="message-action-title">{content.title}</h2>
        <p>{content.text}</p>
        <div className={styles.dialogActions}>
          <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className={styles[content.tone]} onClick={onConfirm} disabled={busy}>{content.confirm}</button>
        </div>
      </section>
    </div>
  );
}

export default MessageActionDialog;
