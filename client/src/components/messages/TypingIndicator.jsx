import styles from './Messages.module.css';

function TypingIndicator({ typing }) {
  if (!typing?.isTyping) return null;
  return <p className={styles.typing}>Someone is typing?</p>;
}
export default TypingIndicator;
