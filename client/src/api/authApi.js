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

export async function refresh(refreshToken) {
  const res = await api.post('/auth/refresh', { refreshToken });
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
  refresh,
  logout,
  changePassword
};
