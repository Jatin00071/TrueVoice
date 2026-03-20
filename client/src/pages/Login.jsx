import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../hooks/useAuth.js';
import styles from './Login.module.css';

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function Login() {
  const { isAuthenticated, login, isLoading } = useAuthContext();
  const location = useLocation();
  const [loginMethod, setLoginMethod] = useState('email');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    try {
      const payload = loginMethod === 'email'
        ? { email: identifier.trim(), password }
        : { username: identifier.trim(), password };
      await login(payload);
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to sign you in.'));
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
          <p className={styles.brandTagline}>Your content. Your credit. Your safety.</p>
        </div>
      </aside>

      <main className={styles.rightPanel}>
        <div className={styles.formCard}>
          <h1 className={styles.formTitle}>Welcome back</h1>
          <p className={styles.formSubtitle}>Sign in to TrueVoice</p>

          {location.state?.registered ? <p className={styles.successMsg}>Account created. You can sign in now.</p> : null}

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
              <label className={styles.fieldLabel} htmlFor="login-password">
                Password
              </label>
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
