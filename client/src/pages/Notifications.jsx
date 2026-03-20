import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from '../api/notificationApi.js';
import styles from './Notifications.module.css';

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

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

function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const data = await getNotifications();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load notifications.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleItemClick = async (notification) => {
    try {
      if (!notification.is_read) {
        await markNotificationRead(notification.id);
        setItems((current) =>
          current.map((item) => (item.id === notification.id ? { ...item, is_read: 1 } : item))
        );
      }
    } catch (markError) {
      setError(getErrorMessage(markError, 'Unable to update the notification.'));
    } finally {
      if (notification.post_id) {
        navigate(`/post/${notification.post_id}`);
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setItems((current) => current.map((item) => ({ ...item, is_read: 1 })));
    } catch (markError) {
      setError(getErrorMessage(markError, 'Unable to mark all notifications as read.'));
    }
  };

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Notifications</h1>
          <p className={styles.subtitle}>Likes, follows, comments, and reshares in one place.</p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={loadNotifications}
            aria-label="Refresh notifications"
          >
            Refresh
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleMarkAllRead}
            aria-label="Mark all notifications as read"
          >
            Mark all read
          </button>
        </div>
      </div>

      <div className={styles.panel}>
        {isLoading ? <p className={styles.status}>Loading notifications...</p> : null}

        {!isLoading && error ? (
          <div className={styles.feedback}>
            <p className={styles.error}>{error}</p>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={loadNotifications}
              aria-label="Retry notifications"
            >
              Retry
            </button>
          </div>
        ) : null}

        {!isLoading && !error && items.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>You are all caught up.</p>
            <p className={styles.emptyText}>New likes, follows, comments, and origin activity will appear here.</p>
          </div>
        ) : null}

        {!isLoading && !error && items.length > 0 ? (
          <div className={styles.list}>
            {items.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className={`${styles.item} ${notification.is_read ? '' : styles.unread}`}
                onClick={() => handleItemClick(notification)}
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
                    <span className={styles.kind}>{notification.type.replace('_', ' ')}</span>
                    <span className={styles.dot}>•</span>
                    <span className={styles.time}>{formatRelativeTime(notification.created_at)}</span>
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default Notifications;
