import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi.js';
import { userApi } from '../api/userApi.js';
import { useAuthContext } from '../hooks/useAuth.js';
import { useTheme } from '../hooks/useTheme.js';
import styles from './Settings.module.css';

function resolveAssetUrl(value) {
  if (!value) return null;
  if (value.startsWith('http') || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }
  return `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${value}`;
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

export default function Settings() {
  const { user, logout, updateUser } = useAuthContext();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState(null);

  const [notifPrefs, setNotifPrefs] = useState({
    notif_likes: user?.notif_likes ?? 1,
    notif_comments: user?.notif_comments ?? 1,
    notif_follows: user?.notif_follows ?? 1,
    notif_shield: user?.notif_shield ?? 1,
    notif_reshares: user?.notif_reshares ?? 1
  });
  const [notifSaving, setNotifSaving] = useState(false);

  const [privacySettings, setPrivacySettings] = useState({
    is_private: user?.is_private ?? 0,
    fingerprinting_enabled: user?.fingerprinting_enabled ?? 1,
    shield_enabled: user?.shield_enabled ?? 1
  });
  const [privacySaving, setPrivacySaving] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    if (!user) return;

    setNotifPrefs({
      notif_likes: user.notif_likes ?? 1,
      notif_comments: user.notif_comments ?? 1,
      notif_follows: user.notif_follows ?? 1,
      notif_shield: user.notif_shield ?? 1,
      notif_reshares: user.notif_reshares ?? 1
    });
    setPrivacySettings({
      is_private: user.is_private ?? 0,
      fingerprinting_enabled: user.fingerprinting_enabled ?? 1,
      shield_enabled: user.shield_enabled ?? 1
    });
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      await logout();
      navigate('/login');
    }
  };

  const handlePasswordChange = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from current password');
      return;
    }

    setPasswordSaving(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      window.setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (error) {
      setPasswordError(getErrorMessage(error, 'Failed to change password'));
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleNotifToggle = async (key) => {
    if (!user) return;

    const previous = { ...notifPrefs };
    const updated = { ...notifPrefs, [key]: notifPrefs[key] ? 0 : 1 };

    setNotifPrefs(updated);
    setNotifSaving(true);

    try {
      await userApi.updateNotifPrefs(user.id, updated);
      updateUser(updated);
    } catch {
      setNotifPrefs(previous);
    } finally {
      setNotifSaving(false);
    }
  };

  const handlePrivacyToggle = async (key) => {
    if (!user) return;

    const previous = { ...privacySettings };
    const updated = {
      ...privacySettings,
      [key]: privacySettings[key] ? 0 : 1
    };

    setPrivacySettings(updated);
    setPrivacySaving(true);

    try {
      const response = await userApi.updatePrivacy(user.id, updated);
      updateUser(response?.data || response?.user || response);
    } catch {
      setPrivacySettings(previous);
    } finally {
      setPrivacySaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmText !== user.username) return;

    setDeleteBusy(true);
    setDeleteError(null);

    try {
      await userApi.deleteAccount(user.id);
      await logout();
    } catch (error) {
      setDeleteError(getErrorMessage(error, 'Delete account failed'));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Settings</h1>
        <p className={styles.pageSubtitle}>Manage your account, appearance and privacy</p>
      </div>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>PROFILE</p>
        <div className={styles.sectionCard}>
          <div className={styles.profileRedirectRow}>
            <div className={styles.profileRedirectInfo}>
              <div className={styles.profileRedirectAvatar}>
                {user?.avatar_url ? (
                  <img
                    src={resolveAssetUrl(user.avatar_url)}
                    alt={user.display_name || user.username}
                    className={styles.profileRedirectImg}
                  />
                ) : (
                  <div className={styles.profileRedirectInitial}>
                    {(user?.display_name || user?.username || '?')[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <p className={styles.profileRedirectName}>{user?.display_name || user?.username}</p>
                <p className={styles.profileRedirectHandle}>@{user?.username}</p>
              </div>
            </div>
            <button className={styles.saveBtn} onClick={() => navigate(`/profile/${user?.id}`)}>
              Edit profile
            </button>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>ACCOUNT</p>
        <div className={styles.sectionCard}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="settings-email">
              Email address
            </label>
            <input
              id="settings-email"
              className={`${styles.input} ${styles.readOnly}`}
              type="email"
              value={user?.email || ''}
              readOnly
            />
            <p className={styles.fieldHint}>Email address cannot be changed</p>
          </div>

          <div className={styles.divider} />

          <p className={styles.subSectionTitle}>Change password</p>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="settings-current-password">
              Current password
            </label>
            <div className={styles.passwordWrapper}>
              <input
                id="settings-current-password"
                className={styles.input}
                type={showCurrentPw ? 'text' : 'password'}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Enter current password"
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.pwToggle}
                onClick={() => setShowCurrentPw((value) => !value)}
                aria-label="Toggle current password visibility"
              >
                {showCurrentPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="settings-new-password">
              New password
            </label>
            <div className={styles.passwordWrapper}>
              <input
                id="settings-new-password"
                className={styles.input}
                type={showNewPw ? 'text' : 'password'}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Min 8 characters"
                autoComplete="new-password"
              />
              <button
                type="button"
                className={styles.pwToggle}
                onClick={() => setShowNewPw((value) => !value)}
                aria-label="Toggle new password visibility"
              >
                {showNewPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="settings-confirm-password">
              Confirm new password
            </label>
            <input
              id="settings-confirm-password"
              className={styles.input}
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat new password"
              autoComplete="new-password"
            />
          </div>

          {passwordError ? <p className={styles.errorMsg}>{passwordError}</p> : null}
          {passwordSuccess ? <p className={styles.successMsg}>Password changed successfully</p> : null}

          <button
            type="button"
            className={styles.saveBtn}
            onClick={handlePasswordChange}
            disabled={passwordSaving}
            aria-label="Update password"
          >
            {passwordSaving ? 'Updating...' : 'Update password'}
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>NOTIFICATIONS</p>
        <div className={styles.sectionCard}>
          <p className={styles.sectionNote}>
            {notifSaving ? 'Saving preferences...' : 'Choose what you want to be notified about'}
          </p>

          {[
            { key: 'notif_likes', label: 'Likes', desc: 'When someone likes your post' },
            { key: 'notif_comments', label: 'Comments', desc: 'When someone comments on your post' },
            { key: 'notif_follows', label: 'New followers', desc: 'When someone follows you' },
            { key: 'notif_reshares', label: 'Content reshared', desc: 'When your original content is reposted' },
            { key: 'notif_shield', label: 'Shield alerts', desc: 'When Shield Mode activates on your post' }
          ].map(({ key, label, desc }) => (
            <div key={key} className={styles.toggleRow}>
              <div className={styles.toggleInfo}>
                <span className={styles.toggleLabel}>{label}</span>
                <span className={styles.toggleDesc}>{desc}</span>
              </div>
              <button
                type="button"
                className={`${styles.toggle} ${notifPrefs[key] ? styles.toggleOn : ''}`}
                onClick={() => handleNotifToggle(key)}
                aria-label={`Toggle ${label} notifications`}
                role="switch"
                aria-checked={Boolean(notifPrefs[key])}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>APPEARANCE</p>
        <div className={styles.sectionCard}>
          <div className={styles.toggleRow}>
            <div className={styles.toggleInfo}>
              <span className={styles.toggleLabel}>Dark mode</span>
              <span className={styles.toggleDesc}>Switch between light and dark theme</span>
            </div>
            <button
              type="button"
              className={`${styles.toggle} ${theme === 'dark' ? styles.toggleOn : ''}`}
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              role="switch"
              aria-checked={theme === 'dark'}
            >
              <span className={styles.toggleKnob} />
            </button>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>PRIVACY</p>
        <div className={styles.sectionCard}>
          {[
            {
              key: 'is_private',
              label: 'Private account',
              desc: 'Only approved followers can see your posts. New followers must request to follow you.',
              warning: true
            },
            {
              key: 'fingerprinting_enabled',
              label: 'Content fingerprinting',
              desc: 'Your original posts are fingerprinted. If anyone reposts your content, you automatically receive credit.'
            },
            {
              key: 'shield_enabled',
              label: 'Shield Mode (default)',
              desc: 'New posts have Shield Mode enabled by default. You can still toggle it per post.'
            }
          ].map(({ key, label, desc, warning }) => (
            <div key={key} className={styles.toggleRow}>
              <div className={styles.toggleInfo}>
                <span className={styles.toggleLabel}>{label}</span>
                <span className={styles.toggleDesc}>{desc}</span>
              </div>
              <button
                type="button"
                className={`${styles.toggle} ${privacySettings[key] ? styles.toggleOn : ''} ${warning && privacySettings[key] ? styles.toggleWarning : ''}`}
                onClick={() => handlePrivacyToggle(key)}
                disabled={privacySaving}
                aria-label={`Toggle ${label}`}
                role="switch"
                aria-checked={Boolean(privacySettings[key])}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>SESSION</p>
        <div className={styles.sectionCard}>
          <div className={styles.logoutRow}>
            <div className={styles.logoutInfo}>
              <p className={styles.logoutTitle}>Sign out</p>
              <p className={styles.logoutDesc}>Sign out of TrueVoice on this device</p>
            </div>
            <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>DANGER ZONE</p>
        <div className={`${styles.sectionCard} ${styles.dangerCard}`}>
          <p className={styles.dangerTitle}>Delete your account</p>
          <p className={styles.dangerDesc}>
            This is permanent and cannot be undone. All your posts, comments, likes, and followers will be removed
            immediately.
          </p>

          {!showDeleteConfirm ? (
            <button
              type="button"
              className={styles.dangerBtn}
              onClick={() => setShowDeleteConfirm(true)}
              aria-label="Delete my account"
            >
              Delete my account
            </button>
          ) : (
            <div className={styles.deleteConfirmBox}>
              <p className={styles.deleteConfirmText}>
                To confirm, type your username <strong>@{user?.username}</strong> below:
              </p>
              <input
                className={`${styles.input} ${styles.deleteInput}`}
                type="text"
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
                placeholder={`Type ${user?.username} to confirm`}
              />
              <div className={styles.deleteActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                    setDeleteError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.dangerBtnFilled}
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== user?.username || deleteBusy}
                >
                  {deleteBusy ? 'Deleting...' : 'Yes, delete my account'}
                </button>
              </div>
              {deleteError ? <p className={styles.errorMsg}>{deleteError}</p> : null}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
