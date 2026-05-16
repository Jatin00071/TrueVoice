import ConversationItem from './ConversationItem.jsx';
import styles from './Messages.module.css';

function ConversationList({ conversations, activeId, onSelect, filter, onFilterChange }) {
  const filtered = conversations.filter((item) => {
    const q = filter.trim().toLowerCase();
    return !q || item.other_username?.toLowerCase().includes(q) || item.other_display_name?.toLowerCase().includes(q);
  });
  return <div className={styles.conversationPanel}><input className={styles.search} placeholder="Search conversations" value={filter} onChange={(e) => onFilterChange(e.target.value)} />{filtered.map((conversation) => <ConversationItem key={conversation.id} conversation={conversation} active={String(activeId) === String(conversation.id)} onClick={() => onSelect(conversation)} />)}{filtered.length === 0 ? <p className={styles.empty}>No conversations yet.</p> : null}</div>;
}
export default ConversationList;
