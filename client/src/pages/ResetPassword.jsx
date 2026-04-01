import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/authApi.js';
import styles from './AuthAssist.module.css';

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError('This password reset link is missing or incomplete.');
      return;
    }

    if (!password.trim()) {
      setError('Please enter a new password.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await authApi.resetPassword(token, password);
      setSuccess(response?.message || 'Password reset successful. You can sign in now.');
      window.setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: {
            passwordReset: true,
            message: response?.message || 'Password reset successful. You can sign in now.'
          }
        });
      }, 1200);
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to reset password.'));
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
          <p className={styles.brandTagline}>Choose a fresh password and get back into your account.</p>
        </div>
      </aside>

      <main className={styles.rightPanel}>
        <div className={styles.card}>
          <span className={`${styles.badge} ${error ? styles.badgeError : success ? styles.badgeSuccess : styles.badgeNeutral}`}>
            {success ? 'Password updated' : error ? 'Link issue' : 'Reset password'}
          </span>
          <h1 className={styles.title}>Set a new password</h1>
          <p className={styles.message}>
            Use the password reset link from your email to choose a new password for your account.
          </p>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="reset-password">
                New password
              </label>
              <input
                id="reset-password"
                className={styles.input}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="reset-confirm-password">
                Confirm new password
              </label>
              <input
                id="reset-confirm-password"
                className={styles.input}
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat your new password"
                autoComplete="new-password"
              />
            </div>

            {error ? <p className={styles.errorMsg}>{error}</p> : null}
            {success ? <p className={styles.successMsg}>{success}</p> : null}

            <div className={styles.actions}>
              <button type="submit" className={styles.primaryBtn} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Reset password'}
              </button>
              <Link to="/forgot-password" className={styles.secondaryLink}>
                Request another link
              </Link>
            </div>
          </form>

          <p className={styles.switchText}>
            Back to{' '}
            <Link to="/login" className={styles.switchLink}>
              sign in
            </Link>
          </p>
        </div>
      </main>
    </section>
  );
}

export default ResetPassword;
