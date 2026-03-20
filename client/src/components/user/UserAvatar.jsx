import styles from './UserAvatar.module.css';

function resolveAssetUrl(value) {
  if (!value) return null;
  if (value.startsWith('http') || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }
  return `${import.meta.env.VITE_API_URL || 'https://truevoice-9qth.onrender.com'}${value}`;
}

function UserAvatar({ user, size = 32, className = '' }) {
  const initials = (user?.display_name || user?.username || 'U')[0];
  const avatarUrl = resolveAssetUrl(user?.avatar_url);
  return (
    <div
      className={[styles.avatar, className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
      role="img"
      aria-label={user?.username ? `${user.display_name || user.username}'s avatar` : 'User avatar'}
    >
      {avatarUrl ? (
        <img className={styles.image} src={avatarUrl} alt="" aria-hidden="true" />
      ) : (
        <span className={styles.initial}>{initials}</span>
      )}
    </div>
  );
}

export default UserAvatar;
