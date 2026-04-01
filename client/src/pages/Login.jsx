import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { authApi } from '../api/authApi.js';
import { useAuthContext } from '../hooks/useAuth.js';
import styles from './Login.module.css';

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function Login() {
  const { isAuthenticated, login, isLoading } = useAuthContext();
  const location = useLocation();
  const initialNotice = location.state?.verified
    ? 'Email verified. You can sign in now.'
    : location.state?.passwordReset
      ? location.state.message || 'Password reset successful. You can sign in now.'
    : location.state?.message
      ? location.state.message
      : location.state?.needsVerification
        ? `Check ${location.state?.email || 'your inbox'} for the verification link before signing in.`
        : location.state?.registered
          ? 'Account created. Check your email for the verification link.'
          : '';

  const [loginMethod, setLoginMethod] = useState('email');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(initialNotice);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendTarget, setResendTarget] = useState(
    location.state?.email ? { email: location.state.email } : null
  );
  const [verificationUrl, setVerificationUrl] = useState(location.state?.verificationUrl || '');

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/feed" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!identifier.trim() || !password.trim()) {
      setError(`${loginMethod === 'email' ? 'Email address' : 'Username'} and password are required.`);
      return;
    }

    setIsSubmitting(true);
    setVerificationUrl('');

    try {
      const payload = loginMethod === 'email'
        ? { email: identifier.trim(), password }
        : { username: identifier.trim(), password };
      await login(payload);
    } catch (submitError) {
      const nextError = getErrorMessage(submitError, 'Unable to sign you in.');
      const code = submitError?.response?.data?.code;

      setError(nextError);

      if (code === 'UNVERIFIED_EMAIL') {
        setResendTarget(
          loginMethod === 'email'
            ? { email: identifier.trim() }
            : { username: identifier.trim() }
        );
        setNotice('Your account is waiting for email verification. Request a fresh link below.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (!resendTarget) return;

    setError('');
    setIsResending(true);

    try {
      const response = await authApi.resendVerification(resendTarget);
      setNotice(response?.message || 'A fresh verification email is on its way.');
      setVerificationUrl(response?.verificationUrl || '');
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to resend verification email.'));
    } finally {
      setIsResending(false);
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
          <p className={styles.brandTagline}>Your content. Your credit. Your safety.</p>
        </div>
      </aside>

      <main className={styles.rightPanel}>
        <div className={styles.formCard}>
          <h1 className={styles.formTitle}>Welcome back</h1>
          <p className={styles.formSubtitle}>Sign in to TrueVoice</p>

          {notice ? <p className={styles.successMsg}>{notice}</p> : null}

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.loginToggle} aria-label="Choose login method">
              <button
                type="button"
                className={`${styles.toggleTab} ${loginMethod === 'email' ? styles.toggleTabActive : ''}`}
                onClick={() => {
                  setLoginMethod('email');
                  setIdentifier('');
                  setError('');
                }}
              >
                Email
              </button>
              <button
                type="button"
                className={`${styles.toggleTab} ${loginMethod === 'username' ? styles.toggleTabActive : ''}`}
                onClick={() => {
                  setLoginMethod('username');
                  setIdentifier('');
                  setError('');
                }}
              >
                Username
              </button>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="login-identifier">
                {loginMethod === 'email' ? 'Email address' : 'Username'}
              </label>
              <input
                id="login-identifier"
                className={styles.input}
                type={loginMethod === 'email' ? 'email' : 'text'}
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder={loginMethod === 'email' ? 'you@example.com' : 'your_username'}
                autoComplete={loginMethod === 'email' ? 'email' : 'username'}
              />
            </div>

            <div className={styles.field}>
              <div className={styles.fieldHeader}>
                <label className={styles.fieldLabel} htmlFor="login-password">
                  Password
                </label>
                <Link to="/forgot-password" className={styles.inlineLink}>
                  Forgot password?
                </Link>
              </div>
              <div className={styles.passwordWrapper}>
                <input
                  id="login-password"
                  className={styles.input}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className={styles.pwToggle}
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error ? <p className={styles.errorMsg}>{error}</p> : null}

            {resendTarget ? (
              <div className={styles.verificationActions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={handleResendVerification}
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
            ) : null}

            <button type="submit" className={styles.submitBtn} disabled={isSubmitting} aria-label="Sign in">
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className={styles.switchText}>
            Don't have an account?{' '}
            <Link to="/register" className={styles.switchLink}>
              Register
            </Link>
          </p>
        </div>
      </main>
    </section>
  );
}

export default Login;
