import styles from './Messages.module.css';

function ShieldIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9.5 12 1.7 1.7 3.8-4" /></svg>;
}

function EncryptionIndicator({ variant = 'default' }) {
  return <span className={`${styles.encryption} ${variant === 'shield' ? styles.encryptionShield : ''}`}><ShieldIcon /> End-to-end encrypted</span>;
}

export default EncryptionIndicator;
