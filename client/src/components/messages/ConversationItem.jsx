import OnlineStatus from './OnlineStatus.jsx';
import styles from './Messages.module.css';

function formatConversationTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ConversationItem({ conversation, active, onClick }) {
  const name = conversation.other_display_name || conversation.other_username || 'TrueVoice user';
  const unread = Number(conversation.unread_count || 0);
  const preview = unread > 0 ? '?? New encrypted message' : '?? End-to-end encrypted conversation';

  return (
    <button
      type="button"
      className={`${styles.conversationItem} ${active ? styles.active : ''} ${unread ? styles.unread : ''}`.trim()}
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
    >
      <span className={styles.avatarWrap}>
        <span className={styles.avatar}>{name[0]?.toUpperCase()}</span>
        <OnlineStatus online={false} />
      </span>
      <span className={styles.conversationText}>
        <span className={styles.conversationTopRow}>
          <strong>{name}</strong>
          <time>{formatConversationTime(conversation.last_message_timestamp || conversation.created_at)}</time>
        </span>
        <span className={styles.previewRow}>{preview}</span>
      </span>
      {unread > 0 ? <span className={styles.badge}>{Math.min(unread, 99)}</span> : null}
    </button>
  );
}

export default ConversationItem;
