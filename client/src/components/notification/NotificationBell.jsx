import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from '../../api/notificationApi.js';
import NotificationDropdown from './NotificationDropdown.jsx';
import styles from './NotificationBell.module.css';

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6.5 9.5a5.5 5.5 0 1 1 11 0c0 6 2 7 2 7h-15s2-1 2-7Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function NotificationBell() {
  const navigate = useNavigate();
  const wrapperRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const data = await getNotifications();
      setNotifications(Array.isArray(data?.items) ? data.items : []);
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load notifications.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  const unread = notifications.filter((item) => !item.is_read).length;

  const handleToggle = async () => {
    const next = !isOpen;
    setIsOpen(next);

    if (next) {
      await loadNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((current) => current.map((item) => ({ ...item, is_read: 1 })));
    } catch (markError) {
      setError(getErrorMessage(markError, 'Unable to mark all notifications as read.'));
    }
  };

  const handleItemClick = async (notification) => {
    try {
      if (!notification.is_read) {
        await markNotificationRead(notification.id);
        setNotifications((current) =>
          current.map((item) => (item.id === notification.id ? { ...item, is_read: 1 } : item))
        );
      }
    } catch (markError) {
      setError(getErrorMessage(markError, 'Unable to update the notification.'));
    } finally {
      setIsOpen(false);
      if (notification.post_id) {
        navigate(`/post/${notification.post_id}`);
      }
    }
  };

  const handleViewAll = () => {
    setIsOpen(false);
    navigate('/notifications');
  };

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button type="button" className={styles.button} aria-label="Notifications" onClick={handleToggle}>
        <span className={styles.icon} aria-hidden="true">
          <BellIcon />
        </span>
        {unread > 0 ? <span className={styles.badge}>{Math.min(unread, 99)}</span> : null}
      </button>

      {isOpen ? (
        <div className={styles.dropdownWrap}>
          <NotificationDropdown
            notifications={notifications}
            isLoading={isLoading}
            error={error}
            onRetry={loadNotifications}
            onMarkAllRead={handleMarkAllRead}
            onItemClick={handleItemClick}
            onViewAll={handleViewAll}
          />
        </div>
      ) : null}
    </div>
  );
}

export default NotificationBell;
