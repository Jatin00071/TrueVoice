import axios from 'axios';
import { getAuthContext } from '../context/authStore.js';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/v1`
});

let isRefreshing = false;
let refreshQueue = [];

api.interceptors.request.use((config) => {
  const auth = getAuthContext();
  if (auth?.accessToken) {
    config.headers.Authorization = `Bearer ${auth.accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config ?? {};
    const auth = getAuthContext();
    const isAuthRoute = typeof original.url === 'string' && original.url.startsWith('/auth/');

    if (!auth) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !original._retry && !isAuthRoute) {
      if (!auth.refreshToken) {
        auth.logout();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        })
          .then((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            return api(original);
          })
          .catch((err) => Promise.reject(err));
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const res = await auth.refreshSession();
        const token = res.accessToken;
        refreshQueue.forEach((p) => p.resolve(token));
        refreshQueue = [];
        isRefreshing = false;

        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch (e) {
        refreshQueue.forEach((p) => p.reject(e));
        refreshQueue = [];
        isRefreshing = false;
        auth.logout();
        return Promise.reject(e);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
