import { Link, useLocation } from 'react-router-dom';
import NotificationBell from '../notification/NotificationBell.jsx';
import UserAvatar from '../user/UserAvatar.jsx';
import styles from './TopBar.module.css';
import { useAuthContext } from '../../hooks/useAuth.js';

function getRouteMeta(pathname) {
  if (pathname.startsWith('/discover')) {
    return {
      eyebrow: 'Explore',
      title: 'Discover new voices'
    };
  }
  if (pathname.startsWith('/notifications')) {
    return {
      eyebrow: 'Activity',
      title: 'Your latest alerts'
    };
  }
  if (pathname.startsWith('/settings')) {
    return {
      eyebrow: 'Preferences',
      title: 'Tune your account'
    };
  }
  if (pathname.startsWith('/profile/')) {
    return {
      eyebrow: 'Identity',
      title: 'Profile view'
    };
  }
  if (pathname.startsWith('/post/')) {
    return {
      eyebrow: 'Conversation',
      title: 'Thread view'
    };
  }
  return {
    eyebrow: 'Timeline',
    title: 'Fresh from your feed'
  };
}

function TopBar() {
  const { user } = useAuthContext();
  const location = useLocation();
  const routeMeta = getRouteMeta(location.pathname);

  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <Link to="/feed" className={styles.logoLink} aria-label="TrueVoice home">
          <span className={styles.logoMark}>TV</span>
          <span className={styles.logo}>TrueVoice</span>
        </Link>
        <div className={styles.pageMeta}>
          <span className={styles.eyebrow}>{routeMeta.eyebrow}</span>
          <span className={styles.pageTitle}>{routeMeta.title}</span>
        </div>
      </div>
      <div className={styles.right}>
        <NotificationBell />
        {user && (
          <Link
            to={`/profile/${user.id}`}
            state={{ from: location }}
            aria-label="Your profile"
            className={styles.profileLink}
          >
            <UserAvatar size={34} user={user} />
          </Link>
        )}
      </div>
    </header>
  );
}

export default TopBar;
