import styles from './Messages.module.css';

function MessagesLayout({ sidebar, children }) {
  return (
    <section className={styles.layout} aria-label="Messages hub">
      <aside className={styles.sidebar} aria-label="Conversation list">{sidebar}</aside>
      <div className={styles.chat}>{children}</div>
    </section>
  );
}

export default MessagesLayout;
