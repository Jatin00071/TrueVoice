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
    { key: 2, label: 'Verify email' }
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationUrl, setVerificationUrl] = useState('');

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
      const response = await authApi.register(username.trim(), email.trim(), password, displayName.trim(), '');
      setVerificationEmail(email.trim());
      setVerificationUrl(response?.verificationUrl || '');
      setStep(2);
      setSuccess(response?.message || `Account created. Check ${email.trim()} to verify your account.`);
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Registration failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!verificationEmail) return;

    setError('');
    setIsResending(true);

    try {
      const response = await authApi.resendVerification({ email: verificationEmail });
      setSuccess(response?.message || 'A fresh verification email is on its way.');
      setVerificationUrl(response?.verificationUrl || '');
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to resend verification email.'));
    } finally {
      setIsResending(false);
    }
  };

  const handleContinueToLogin = () => {
    navigate('/login', {
      replace: true,
      state: {
        needsVerification: true,
        email: verificationEmail,
        message: success,
        verificationUrl
      }
    });
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
          <div className={styles.mobileBrand}>
            <span className={styles.mobileLogo} aria-hidden="true">TV</span>
            <div>
              <p className={styles.mobileBrandName}>TrueVoice</p>
              <p className={styles.mobileBrandTagline}>Your content. Your credit.</p>
            </div>
          </div>

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
              <p className={styles.successMsg}>{success || 'Account created. Check your email to verify your account.'}</p>
              <p className={styles.helperText}>
                Verify the inbox for <span className={styles.emphasis}>{verificationEmail}</span> before signing in.
              </p>

              {error ? <p className={styles.errorMsg}>{error}</p> : null}

              <div className={styles.actionStack}>
                <button type="button" className={styles.submitBtn} onClick={handleContinueToLogin}>
                  Continue to sign in
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={handleResend}
                  disabled={isResending}
                >
                  {isResending ? 'Sending...' : 'Resend verification email'}
                </button>
                {verificationUrl ? (
                  <a
                    href={verificationUrl}
                    className={styles.utilityLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open verification link
                  </a>
                ) : null}
              </div>
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
