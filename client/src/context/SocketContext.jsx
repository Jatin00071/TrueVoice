import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuthContext } from '../hooks/useAuth.js';
import { SocketContext } from './socketStore.js';

export function SocketProvider({ children }) {
  const { accessToken } = useAuthContext();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://truevoice-9qth.onrender.com';

    const nextSocket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      withCredentials: true
    });

    const showToast = (message, tone = 'info', duration = 5000) => {
      if (!message) {
        return;
      }

      window.dispatchEvent(
        new CustomEvent('tv:toast', {
          detail: { message, tone, duration }
        })
      );
    };

    const removePostFromFeed = (postId) => {
      if (!postId) {
        return;
      }

      window.dispatchEvent(
        new CustomEvent('post:removed', {
          detail: { postId }
        })
      );
    };

    const updatePostShieldState = (postId, shieldActive) => {
      if (!postId) {
        return;
      }

      window.dispatchEvent(
        new CustomEvent('post:shield-updated', {
          detail: { postId, shieldActive }
        })
      );
    };

    const handleConnect = () => {
      setSocket(nextSocket);
      setIsConnected(true);
    };
    const handleDisconnect = () => {
      setSocket((current) => (current === nextSocket ? null : current));
      setIsConnected(false);
    };
    const handlePostRemoved = (data = {}) => {
      removePostFromFeed(data.postId);
      showToast(`Your post was removed: ${data.reason}`, 'warning', 8000);
    };
    const handleShieldActivated = (data = {}) => {
      updatePostShieldState(data.postId, true);

      if (data.postChecked && data.postClean) {
        showToast(
          `Shield activated on your post - ${data.toxicCount} abusive comments blocked. ` +
            'Your post content was reviewed and is clean.',
          'shield',
          6000
        );
        return;
      }

      showToast(data.message || 'Shield Mode activated on your post', 'shield', 5000);
    };

    nextSocket.on('connect', handleConnect);
    nextSocket.on('disconnect', handleDisconnect);
    nextSocket.on('post:removed', handlePostRemoved);
    nextSocket.on('shield:activated', handleShieldActivated);

    return () => {
      nextSocket.off('connect', handleConnect);
      nextSocket.off('disconnect', handleDisconnect);
      nextSocket.off('post:removed', handlePostRemoved);
      nextSocket.off('shield:activated', handleShieldActivated);
      nextSocket.disconnect();
    };
  }, [accessToken]);

  const value = useMemo(
    () => ({
      socket,
      isConnected
    }),
    [isConnected, socket]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
