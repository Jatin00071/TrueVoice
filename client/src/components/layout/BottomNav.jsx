import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import styles from './BottomNav.module.css';
import { useAuthContext } from '../../hooks/useAuth.js';
import { useMessages } from '../../hooks/useMessages.js';

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

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
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

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 3.5v3M12 17.5v3M4.6 6.6l2.1 2.1M17.3 17.3l2.1 2.1M3.5 12h3M17.5 12h3M4.6 17.4l2.1-2.1M17.3 6.7l2.1-2.1" />
      <circle cx="12" cy="12" r="3.25" />
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

function BottomNav() {
  const { user } = useAuthContext();
  const messageState = useMessages();
  const navigate = useNavigate();
  const location = useLocation();

  const handleCreate = () => {
    try {
      window.sessionStorage.setItem('tv:openComposer', '1');
    } catch {
      // Ignore storage issues and rely on the direct event path.
    }

    if (location.pathname !== '/feed') {
      navigate('/feed');
    }

    window.dispatchEvent(new CustomEvent('tv:openComposer'));
  };

  return (
    <nav className={styles.nav} aria-label="Primary">
      <NavLink to="/feed" className={({ isActive }) => (isActive ? `${styles.item} ${styles.active}` : styles.item)}>
        <span aria-hidden="true" className={styles.icon}>
          <HomeIcon />
        </span>
        <span className={styles.label}>Home</span>
      </NavLink>
      <NavLink
        to="/discover"
        className={({ isActive }) => (isActive ? `${styles.item} ${styles.active}` : styles.item)}
      >
        <span aria-hidden="true" className={styles.icon}>
          <DiscoverIcon />
        </span>
        <span className={styles.label}>Discover</span>
      </NavLink>
      <button
        type="button"
        className={styles.item}
        onClick={handleCreate}
        aria-label="Create post"
      >
        <span aria-hidden="true" className={styles.icon}>
          <PlusIcon />
        </span>
        <span className={styles.label}>Create</span>
      </button>
      {user ? (
        <NavLink
          to="/messages"
          className={({ isActive }) => (isActive ? `${styles.item} ${styles.active}` : styles.item)}
        >
          <span aria-hidden="true" className={styles.icon}>
            <MessageIcon />
          </span>
          <span className={styles.label}>Messages</span>
          {messageState?.unreadCount > 0 ? <span className={styles.badge}>{Math.min(messageState.unreadCount, 99)}</span> : null}
        </NavLink>
      ) : null}
      {user ? (
        <NavLink
          to={`/profile/${user.id}`}
          className={({ isActive }) => (isActive ? `${styles.item} ${styles.active}` : styles.item)}
        >
          <span aria-hidden="true" className={styles.icon}>
            <ProfileIcon />
          </span>
          <span className={styles.label}>Profile</span>
        </NavLink>
      ) : null}
      <NavLink
        to="/settings"
        className={({ isActive }) => (isActive ? `${styles.item} ${styles.active}` : styles.item)}
      >
        <span aria-hidden="true" className={styles.icon}>
          <SettingsIcon />
        </span>
        <span className={styles.label}>Settings</span>
      </NavLink>
    </nav>
  );
}

export default BottomNav;
