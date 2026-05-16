import ConversationItem from './ConversationItem.jsx';
import styles from './Messages.module.css';

function EmptyIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4.5 6.5h15v10h-9L6.5 20v-3.5h-2v-10Z" /><path d="M8 10h8M8 13h5" /></svg>;
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
}

function ConversationList({ conversations, activeId, onSelect, filter, onFilterChange, getQueuedCount }) {
  const filtered = conversations.filter((item) => {
    const q = filter.trim().toLowerCase();
    return !q || item.other_username?.toLowerCase().includes(q) || item.other_display_name?.toLowerCase().includes(q);
  });

  return (
    <div className={styles.conversationPanel}>
      <label className={styles.searchWrap}>
        <span><SearchIcon /></span>
        <input
          placeholder="Search conversations"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
          aria-label="Search conversations"
        />
      </label>
      <div className={styles.conversationScroll}>
        {filtered.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            active={String(activeId) === String(conversation.id)}
            onClick={() => onSelect(conversation)}
            pendingCount={getQueuedCount?.(conversation.id) || 0}
          />
        ))}
        {filtered.length === 0 ? (
          <div className={styles.emptyConversations}>
            <EmptyIcon />
            <h3>No conversations yet.</h3>
            <p>Start a new conversation from a user profile.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default ConversationList;
