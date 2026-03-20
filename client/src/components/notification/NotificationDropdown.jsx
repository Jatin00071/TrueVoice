import styles from './NotificationDropdown.module.css';

function resolveAssetUrl(value) {
  if (!value) return null;
  if (value.startsWith('http') || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }
  return `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${value}`;
}

function formatRelativeTime(value) {
  if (!value) return 'Now';

  const diff = Math.max(1, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);

  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getMessage(notification) {
  const name = notification.sender_display_name || notification.sender_username || 'Someone';
  const actionMap = {
    like: 'liked your post',
    comment: 'commented on your post',
    follow: 'started following you',
    shield_activated: 'activated shield on your post',
    content_reshared: 'reshared your content'
  };

  return `${name} ${actionMap[notification.type] || 'sent you an update'}`;
}

function NotificationDropdown({
  notifications,
  isLoading,
  error,
  onRetry,
  onMarkAllRead,
  onItemClick,
  onViewAll
}) {
  return (
    <div className={styles.dropdown}>
      <div className={styles.header}>
        <p className={styles.title}>Notifications</p>
        <div className={styles.actions}>
          {onViewAll ? (
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={onViewAll}
              aria-label="View all notifications"
            >
              View all
            </button>
          ) : null}
          <button
            type="button"
            className={styles.markAll}
            onClick={onMarkAllRead}
            aria-label="Mark all notifications as read"
          >
            Mark all read
          </button>
        </div>
      </div>

      {isLoading ? <p className={styles.status}>Loading notifications...</p> : null}

      {!isLoading && error ? (
        <div className={styles.feedback}>
          <p className={styles.error}>{error}</p>
          <button type="button" className={styles.retry} onClick={onRetry} aria-label="Retry notifications">
            Retry
          </button>
        </div>
      ) : null}

      {!isLoading && !error && notifications.length === 0 ? (
        <p className={styles.status}>No notifications yet.</p>
      ) : null}

      {!isLoading && !error && notifications.length > 0 ? (
        <div className={styles.list}>
          {notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              className={`${styles.item} ${notification.is_read ? '' : styles.unread}`}
              onClick={() => onItemClick(notification)}
              aria-label={getMessage(notification)}
            >
              <div className={styles.avatar} aria-hidden="true" style={{ overflow: 'hidden' }}>
                {resolveAssetUrl(notification.sender_avatar_url) ? (
                  <img
                    src={resolveAssetUrl(notification.sender_avatar_url)}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  (notification.sender_display_name || notification.sender_username || 'N')
                    .charAt(0)
                    .toUpperCase()
                )}
              </div>
              <div className={styles.body}>
                <p className={styles.message}>{getMessage(notification)}</p>
                <p className={styles.meta}>
                  <span className={styles.type}>{notification.type.replace('_', ' ')}</span>
                  <span className={styles.dot}>•</span>
                  <span className={styles.time}>{formatRelativeTime(notification.created_at)}</span>
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default NotificationDropdown;
