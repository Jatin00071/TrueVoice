import { Link } from 'react-router-dom';
import styles from './NotFound.module.css';

function NotFound() {
  return (
    <section className={styles.page}>
      <div className={styles.card}>
        <p className={styles.code}>404</p>
        <h1 className={styles.title}>This page wandered off.</h1>
        <p className={styles.copy}>The route you requested does not exist in the current TrueVoice client.</p>
        <Link to="/feed" className={styles.link}>
          Go to feed
        </Link>
      </div>
    </section>
  );
}

export default NotFound;
