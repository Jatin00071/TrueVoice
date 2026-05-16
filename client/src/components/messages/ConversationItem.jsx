import OnlineStatus from './OnlineStatus.jsx';
import styles from './Messages.module.css';

function ConversationItem({ conversation, active, onClick }) {
  const name = conversation.other_display_name || conversation.other_username || 'TrueVoice user';
  return <button type="button" className={`${styles.conversationItem} ${active ? styles.active : ''}`} onClick={onClick}><span className={styles.avatar}>{name[0]?.toUpperCase()}</span><span className={styles.conversationText}><strong>{name}</strong><small>@{conversation.other_username || conversation.other_user_id}</small></span><OnlineStatus online={false} />{Number(conversation.unread_count) > 0 ? <span className={styles.badge}>{Math.min(Number(conversation.unread_count), 99)}</span> : null}</button>;
}
export default ConversationItem;
