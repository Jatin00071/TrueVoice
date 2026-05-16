import styles from './Messages.module.css';

function MessagesLayout({ sidebar, children }) {
  return <section className={styles.layout}><aside className={styles.sidebar}>{sidebar}</aside><div className={styles.chat}>{children}</div></section>;
}
export default MessagesLayout;
