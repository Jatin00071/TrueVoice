import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as authApi from '../api/authApi.js';
import { AuthContext, setAuthContext } from './authStore.js';

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshPromiseRef = useRef(null);

  const clearSession = useCallback(() => {
    window.localStorage.removeItem('tv_refresh');
    window.localStorage.removeItem('tv_uid');
    setUser(null);
    setAccessToken(null);
  }, []);

  const logout = useCallback(async () => {
    if (accessToken) {
      try {
        await authApi.logout();
      } catch {
        // Local cleanup matters more than surfacing logout failures here.
      }
    }
    clearSession();
    navigate('/login', { replace: true });
  }, [accessToken, clearSession, navigate]);

  const login = useCallback(async (payload, password) => {
    let authPayload;
    if (typeof payload === 'string' && typeof password === 'string') {
      authPayload = { email: payload, password };
    } else if (payload && typeof payload === 'object') {
      authPayload = payload;
    } else {
      throw new Error('Invalid login payload');
    }

    const res = await authApi.login(authPayload);
    const { user: u, accessToken: at, refreshToken: rt } = res;
    setUser(u);
    setAccessToken(at);
    window.localStorage.setItem('tv_refresh', rt);
    window.localStorage.setItem('tv_uid', String(u.id));
    navigate('/feed', { replace: true });
  }, [navigate]);

  const refreshSession = useCallback(async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    const rt = window.localStorage.getItem('tv_refresh');
    if (!rt) {
      clearSession();
      throw new Error('No refresh token');
    }
    const p = authApi
      .refresh(rt)
      .then((data) => {
        setUser(data.user);
        setAccessToken(data.accessToken);
        window.localStorage.setItem('tv_refresh', data.refreshToken);
        return { accessToken: data.accessToken };
      })
      .finally(() => {
        refreshPromiseRef.current = null;
      });
    refreshPromiseRef.current = p;
    return p;
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      const rt = window.localStorage.getItem('tv_refresh');
      if (!rt) {
        setIsLoading(false);
        return;
      }
      try {
        const data = await authApi.refresh(rt);
        if (cancelled) return;
        setUser(data.user);
        setAccessToken(data.accessToken);
        window.localStorage.setItem('tv_refresh', data.refreshToken);
      } catch {
        if (!cancelled) {
          clearSession();
          navigate('/login', { replace: true });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [clearSession, navigate]);

  const updateUser = useCallback((updatedData) => {
    setUser((previous) => {
      const nextData = typeof updatedData === 'function' ? updatedData(previous) : updatedData;
      if (!previous) {
        return nextData ?? previous;
      }
      return {
        ...previous,
        ...(nextData || {})
      };
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isLoading,
      isAuthenticated: !!user && !!accessToken,
      login,
      logout,
      refreshSession,
      updateUser,
      get refreshToken() {
        return window.localStorage.getItem('tv_refresh');
      }
    }),
    [accessToken, isLoading, login, logout, refreshSession, updateUser, user]
  );

  setAuthContext(value);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
