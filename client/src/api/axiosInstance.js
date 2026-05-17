import axios from 'axios';
import { getAuthContext } from '../context/authStore.js';

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : 'https://truevoice-9qth.onrender.com/api/v1';

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 75000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

console.log('[Axios] Base URL:', BASE_URL);

let isRefreshing = false;
let refreshQueue = [];

axiosInstance.interceptors.request.use((config) => {
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (config.headers?.['Content-Type']) {
      delete config.headers['Content-Type'];
    }
    if (config.headers?.['content-type']) {
      delete config.headers['content-type'];
    }
  }

  const auth = getAuthContext();
  if (auth?.accessToken) {
    config.headers.Authorization = `Bearer ${auth.accessToken}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config ?? {};
    const auth = getAuthContext();
    const isAuthRoute = typeof original.url === 'string' && original.url.startsWith('/auth/');

    if (!auth) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !original._retry && !isAuthRoute) {
      if (!auth.canRefresh) {
        auth.logout();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        })
          .then((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            return axiosInstance(original);
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
        return axiosInstance(original);
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

export default axiosInstance;
