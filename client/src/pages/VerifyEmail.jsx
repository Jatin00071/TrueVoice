import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/authApi.js';
import styles from './VerifyEmail.module.css';

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const attemptedRef = useRef(false);
  const [status, setStatus] = useState(token ? 'loading' : 'error');
  const [message, setMessage] = useState(
    token
      ? 'Checking your verification link now.'
      : 'This verification link is missing or incomplete.'
  );

  useEffect(() => {
    if (!token || attemptedRef.current) return;

    attemptedRef.current = true;
    let cancelled = false;

    const verify = async () => {
      try {
        const response = await authApi.verifyEmail(token);
        if (cancelled) return;
        setStatus('success');
        setMessage(response?.message || 'Email verified successfully. You can sign in now.');
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        setMessage(getErrorMessage(error, 'This verification link is invalid or has expired.'));
      }
    };

    verify();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <section className={styles.page}>
      <aside className={styles.leftPanel}>
        <div className={styles.decorCircle1} />
        <div className={styles.decorCircle2} />
        <div className={`${styles.decorLine} ${styles.decorLineOne}`} />
        <div className={`${styles.decorLine} ${styles.decorLineTwo}`} />
        <div className={`${styles.decorLine} ${styles.decorLineThree}`} />

        <div className={styles.brandBlock}>
          <p className={styles.brandName}>TrueVoice</p>
          <p className={styles.brandTagline}>Verify once, then publish with your identity intact.</p>
        </div>
      </aside>

      <main className={styles.rightPanel}>
        <div className={styles.card}>
          <span
            className={`${styles.badge} ${
              status === 'success'
                ? styles.badgeSuccess
                : status === 'error'
                  ? styles.badgeError
                  : styles.badgeLoading
            }`}
          >
            {status === 'loading' ? 'Verifying' : status === 'success' ? 'Verified' : 'Link issue'}
          </span>

          <h1 className={styles.title}>Email verification</h1>
          <p className={styles.message}>{message}</p>

          {status === 'loading' ? <div className={styles.loader} aria-hidden="true" /> : null}

          <div className={styles.actions}>
            {status === 'success' ? (
              <Link to="/login" state={{ verified: true }} className={styles.primaryLink}>
                Continue to sign in
              </Link>
            ) : (
              <Link to="/login" state={{ needsVerification: true }} className={styles.primaryLink}>
                Request a new email
              </Link>
            )}

            <Link to="/register" className={styles.secondaryLink}>
              Back to register
            </Link>
          </div>
        </div>
      </main>
    </section>
  );
}

export default VerifyEmail;
