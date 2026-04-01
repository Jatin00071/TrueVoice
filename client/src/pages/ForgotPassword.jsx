import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/authApi.js';
import styles from './AuthAssist.module.css';

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function ForgotPassword() {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setResetUrl('');

    if (!identifier.trim()) {
      setError('Email or username is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await authApi.forgotPassword({ identifier: identifier.trim() });
      setSuccess(response?.message || 'If an account exists for that login, a password reset link has been sent.');
      setResetUrl(response?.resetUrl || '');
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to send password reset email.'));
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <p className={styles.brandTagline}>Recover your account without losing your voice.</p>
        </div>
      </aside>

      <main className={styles.rightPanel}>
        <div className={styles.card}>
          <span className={`${styles.badge} ${styles.badgeNeutral}`}>Account recovery</span>
          <h1 className={styles.title}>Forgot password?</h1>
          <p className={styles.message}>
            Enter the email or username tied to your account and we&apos;ll send a reset link.
          </p>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="forgot-identifier">
                Email or username
              </label>
              <input
                id="forgot-identifier"
                className={styles.input}
                type="text"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="you@example.com or your_username"
                autoComplete="username"
              />
            </div>

            {error ? <p className={styles.errorMsg}>{error}</p> : null}
            {success ? <p className={styles.successMsg}>{success}</p> : null}

            <div className={styles.actions}>
              <button type="submit" className={styles.primaryBtn} disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send reset link'}
              </button>
              {resetUrl ? (
                <a href={resetUrl} className={styles.utilityLink} target="_blank" rel="noreferrer">
                  Open reset link
                </a>
              ) : null}
            </div>
          </form>

          <p className={styles.switchText}>
            Remembered your password?{' '}
            <Link to="/login" className={styles.switchLink}>
              Back to sign in
            </Link>
          </p>
        </div>
      </main>
    </section>
  );
}

export default ForgotPassword;
