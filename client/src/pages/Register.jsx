import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi.js';
import { useAuthContext } from '../hooks/useAuth.js';
import styles from './Register.module.css';

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function Progress({ step }) {
  const steps = [
    { key: 1, label: 'Create account' },
    { key: 2, label: "You're in" }
  ];

  return (
    <div className={styles.progress} aria-label="Registration progress">
      {steps.map((item, index) => (
        <div key={item.key} className={styles.progressItem}>
          <span
            className={
              item.key < step
                ? `${styles.dot} ${styles.completed}`
                : item.key === step
                  ? `${styles.dot} ${styles.current}`
                  : `${styles.dot} ${styles.pending}`
            }
            aria-hidden="true"
          />
          <span className={styles.progressLabel}>{item.label}</span>
          {index < steps.length - 1 ? <span className={styles.progressLine} aria-hidden="true" /> : null}
        </div>
      ))}
    </div>
  );
}

function Register() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuthContext();
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/feed" replace />;
  }

  const handleRegister = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim() || !email.trim() || !password.trim()) {
      setError('Username, email and password are required');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      await authApi.register(username.trim(), email.trim(), password, displayName.trim(), bio.trim());
      setStep(2);
      setSuccess('Account created. Redirecting to sign in...');
      window.setTimeout(() => {
        navigate('/login', { replace: true, state: { registered: true } });
      }, 1200);
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Registration failed'));
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
          <p className={styles.brandTagline}>Build a social presence with credit and safety built in.</p>
        </div>
      </aside>

      <main className={styles.rightPanel}>
        <div className={styles.formCard}>
          <Progress step={step} />

          <h1 className={styles.formTitle}>Create your account</h1>
          <p className={styles.formSubtitle}>Start publishing on TrueVoice</p>

          {step === 1 ? (
            <form className={styles.form} onSubmit={handleRegister}>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="register-username">
                  Username
                </label>
                <input
                  id="register-username"
                  className={styles.input}
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Choose a username"
                  autoComplete="username"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="register-display-name">
                  <span>Display name</span>
                  <span className={styles.fieldOptional}>shown publicly</span>
                </label>
                <input
                  id="register-display-name"
                  className={styles.input}
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your full name or nickname"
                  maxLength={80}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="register-bio">
                  <span>Bio</span>
                  <span className={styles.fieldOptional}>optional</span>
                </label>
                <textarea
                  id="register-bio"
                  className={styles.textarea}
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="Tell people a little about yourself"
                  maxLength={300}
                  rows={2}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="register-email">
                  Email
                </label>
                <input
                  id="register-email"
                  className={styles.input}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="register-password">
                  Password
                </label>
                <input
                  id="register-password"
                  className={styles.input}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="register-confirm-password">
                  Confirm password
                </label>
                <input
                  id="register-confirm-password"
                  className={styles.input}
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                />
              </div>

              {error ? <p className={styles.errorMsg}>{error}</p> : null}

              <button type="submit" className={styles.submitBtn} disabled={isSubmitting} aria-label="Create account">
                {isSubmitting ? 'Creating...' : 'Create account'}
              </button>
            </form>
          ) : (
            <div className={styles.messageState}>
              <p className={styles.successMsg}>{success || 'Account created successfully.'}</p>
              <p className={styles.formSubtitle}>You can sign in with the username or email you just created.</p>
            </div>
          )}

          <p className={styles.switchText}>
            Already have an account?{' '}
            <Link to="/login" className={styles.switchLink}>
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </section>
  );
}

export default Register;
