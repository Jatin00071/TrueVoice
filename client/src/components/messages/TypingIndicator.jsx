import styles from './Messages.module.css';

function TypingIndicator({ typing }) {
  if (!typing?.isTyping) return null;
  return <div className={styles.typing} aria-label="User is typing"><span /><span /><span /></div>;
}
export default TypingIndicator;
