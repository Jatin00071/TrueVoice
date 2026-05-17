import api from './axiosInstance.js';

export async function register(username, email, password, displayName, bio) {
  const res = await api.post('/auth/register', {
    username,
    email,
    password,
    display_name: displayName || username,
    bio: bio || ''
  });
  return res.data;
}

export async function login(payload, password) {
  let body;

  if (typeof payload === 'string' && typeof password === 'string') {
    body = { email: payload, password };
  } else if (payload && typeof payload === 'object') {
    body = payload;
  } else {
    throw new Error('Invalid login payload');
  }

  const res = await api.post('/auth/login', body);
  return res.data;
}

export async function verifyEmail(token) {
  const res = await api.post('/auth/verify-email', { token });
  return res.data;
}

export async function resendVerification(payload) {
  let body;

  if (typeof payload === 'string') {
    body = { email: payload };
  } else if (payload && typeof payload === 'object') {
    body = payload;
  } else {
    throw new Error('Invalid verification resend payload');
  }

  const res = await api.post('/auth/resend-verification', body);
  return res.data;
}

export async function forgotPassword(payload) {
  let body;

  if (typeof payload === 'string') {
    body = { identifier: payload };
  } else if (payload && typeof payload === 'object') {
    body = payload;
  } else {
    throw new Error('Invalid forgot password payload');
  }

  const res = await api.post('/auth/forgot-password', body);
  return res.data;
}

export async function resetPassword(token, newPassword) {
  const res = await api.post('/auth/reset-password', {
    token,
    newPassword
  });
  return res.data;
}

export async function refresh(refreshToken) {
  const body = refreshToken ? { refreshToken } : {};
  const res = await api.post('/auth/refresh', body);
  return res.data;
}

export async function logout() {
  const res = await api.post('/auth/logout');
  return res.data;
}

export async function changePassword(currentPassword, newPassword) {
  const res = await api.put('/auth/change-password', {
    currentPassword,
    newPassword
  });
  return res.data;
}

export const authApi = {
  register,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  refresh,
  logout,
  changePassword
};
