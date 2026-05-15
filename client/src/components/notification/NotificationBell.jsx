import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from '../../api/notificationApi.js';
import { userApi } from '../../api/userApi.js';
import { useAuthContext } from '../../hooks/useAuth.js';
import NotificationDropdown from './NotificationDropdown.jsx';
import styles from './NotificationBell.module.css';

function BellIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.bellIcon}
      aria-hidden="true"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function NotificationBell() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const wrapperRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [followRequestCount, setFollowRequestCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const [data, requestData] = await Promise.all([
        getNotifications(),
        user?.id ? userApi.getFollowRequests(user.id) : Promise.resolve({ items: [] })
      ]);
      setNotifications(Array.isArray(data?.items) ? data.items : []);
      setFollowRequestCount(Array.isArray(requestData?.items) ? requestData.items.length : 0);
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load notifications.'));
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

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

  const unread = notifications.filter((item) => !item.is_read).length + followRequestCount;

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
      <button type="button" className={styles.bellContainer} aria-label="Notifications" onClick={handleToggle}>
        <BellIcon />
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
