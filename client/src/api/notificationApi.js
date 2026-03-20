import api from './axiosInstance.js';

export async function getNotifications() {
  const res = await api.get('/notifications');
  return res.data;
}

export async function markNotificationRead(id) {
  const res = await api.put(`/notifications/${id}/read`);
  return res.data;
}

export async function markAllNotificationsRead() {
  const res = await api.put('/notifications/read-all');
  return res.data;
}
