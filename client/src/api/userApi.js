import api from './axiosInstance.js';

export async function getProfile(id) {
  const res = await api.get(`/users/${id}`);
  return res.data;
}

export async function updateProfile(id, payload) {
  const config = payload instanceof FormData
    ? { headers: { 'Content-Type': undefined } }
    : undefined;
  const res = await api.put(`/users/${id}`, payload, config);
  return res.data;
}

export async function followUser(id) {
  const res = await api.post(`/users/${id}/follow`);
  return res.data;
}

export async function getFollowers(id) {
  const res = await api.get(`/users/${id}/followers`);
  return res.data;
}

export async function getFollowing(id) {
  const res = await api.get(`/users/${id}/following`);
  return res.data;
}

export async function searchUsers(q) {
  const res = await api.get('/users/search', { params: { q } });
  return res.data;
}

export async function updateNotifPrefs(userId, prefs) {
  const res = await api.put(`/users/${userId}/notification-preferences`, prefs);
  return res.data;
}

export async function updatePrivacy(userId, settings) {
  const res = await api.put(`/users/${userId}/privacy`, settings);
  return res.data;
}

export async function deleteAccount(userId) {
  const res = await api.delete(`/users/${userId}`);
  return res.data;
}

export const userApi = {
  getProfile,
  updateProfile,
  followUser,
  getFollowers,
  getFollowing,
  searchUsers,
  updateNotifPrefs,
  updatePrivacy,
  deleteAccount
};
