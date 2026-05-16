import { useCallback, useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { getNotifications } from '../../api/notificationApi.js';
import { useAuthContext } from '../../hooks/useAuth.js';
import { useMessages } from '../../hooks/useMessages.js';
import styles from './LeftSidebar.module.css';

function resolveAssetUrl(value) {
  if (!value) return null;
  if (value.startsWith('http') || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }
  return `${import.meta.env.VITE_API_URL || 'https://truevoice-9qth.onrender.com'}${value}`;
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10.5V20h13V10.5" />
    </svg>
  );
}

function DiscoverIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m12 3 2.3 4.8L19 10l-4.7 2.2L12 17l-2.3-4.8L5 10l4.7-2.2L12 3Z" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6.5 9.5a5.5 5.5 0 1 1 11 0c0 6 2 7 2 7h-15s2-1 2-7Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4.5 6.5h15v10h-9L6.5 20v-3.5h-2v-10Z" />
      <path d="M8 10h8M8 13h5" />
    </svg>
  );
}

function navClassName({ isActive }) {
  return `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`.trim();
}

function LeftSidebar() {
  const { user } = useAuthContext();
  const messageState = useMessages();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);

  const unread = notifications.filter((item) => !item.is_read).length;

  const loadNotifications = useCallback(async () => {
    if (!user) return;

    try {
      const data = await getNotifications();
      setNotifications(Array.isArray(data?.items) ? data.items : []);
    } catch {
      // Keep the sidebar badge resilient even if the API is temporarily unavailable.
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void loadNotifications();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [user, loadNotifications, location.pathname]);

  const handleCreate = () => {
    try {
      window.sessionStorage.setItem('tv:openComposer', '1');
    } catch {
      // Ignore storage issues and rely on the direct event path.
    }

    if (location.pathname !== '/feed') {
      navigate('/feed', { replace: false });
    }

    window.dispatchEvent(new CustomEvent('tv:openComposer'));
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles.logoArea}>
        <span className={styles.logoText}>TrueVoice</span>
      </div>

      <nav className={styles.nav}>
        <NavLink to="/feed" className={navClassName}>
          <span className={styles.icon} aria-hidden="true">
            <HomeIcon />
          </span>
          <span className={styles.label}>Home</span>
        </NavLink>

        <NavLink to="/discover" className={navClassName}>
          <span className={styles.icon} aria-hidden="true">
            <DiscoverIcon />
          </span>
          <span className={styles.label}>Discover</span>
        </NavLink>

        <button type="button" className={styles.createButton} onClick={handleCreate} aria-label="Create a post">
          <span className={styles.createPlus} aria-hidden="true">
            +
          </span>
          <span className={styles.createLabel}>Create</span>
        </button>

        {user ? (
          <>
            <NavLink to={`/profile/${user.id}`} className={navClassName}>
              <span className={styles.icon} aria-hidden="true">
                <ProfileIcon />
              </span>
              <span className={styles.label}>Profile</span>
            </NavLink>

            <NavLink to="/messages" className={navClassName}>
              <span className={styles.icon} aria-hidden="true">
                <MessageIcon />
              </span>
              <span className={styles.label}>Messages</span>
              {messageState?.unreadCount > 0 ? <span className={styles.badge}>{Math.min(messageState.unreadCount, 99)}</span> : null}
            </NavLink>

            <NavLink to="/notifications" className={navClassName}>
              <span className={styles.icon} aria-hidden="true">
                <BellIcon />
              </span>
              <span className={styles.label}>Notifications</span>
              {unread > 0 ? <span className={styles.badge}>{Math.min(unread, 99)}</span> : null}
            </NavLink>
          </>
        ) : null}
      </nav>

      {user ? (
        <NavLink
          to="/settings"
          className={({ isActive }) => `${styles.me} ${isActive ? styles.meActive : ''}`.trim()}
          aria-label="Open settings"
        >
          <div className={styles.avatar} aria-hidden="true">
            {user.avatar_url ? (
              <img
                src={resolveAssetUrl(user.avatar_url)}
                alt={user.display_name || user.username}
                className={styles.avatarImage}
              />
            ) : (
              (user.display_name?.[0] || user.username?.[0] || 'U').toUpperCase()
            )}
          </div>
          <div className={styles.meInfo}>
            <div className={styles.meName}>{user.display_name || user.username}</div>
            <div className={styles.meHandle}>@{user.username}</div>
          </div>
        </NavLink>
      ) : null}
    </div>
  );
}

export default LeftSidebar;
