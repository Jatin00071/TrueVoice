import axios from './axiosInstance.js';

export async function getConversations(params = {}) {
  const { data } = await axios.get('/conversations', { params });
  return data;
}

export async function getConversation(id) {
  const { data } = await axios.get(`/conversations/${id}`);
  return data;
}

export async function getConversationDetails(id) {
  const { data } = await axios.get(`/conversations/${id}/details`);
  return data;
}

export async function startConversation(userId) {
  const { data } = await axios.post(`/conversations/${userId}`);
  return data;
}

export async function archiveConversation(id) {
  const { data } = await axios.delete(`/conversations/${id}`);
  return data;
}

export async function pinConversation(id) {
  const { data } = await axios.patch(`/conversations/${id}/pin`);
  return data;
}

export async function muteConversation(id, { mutedUntil = null } = {}) {
  const { data } = await axios.patch(`/conversations/${id}/mute`, { mutedUntil });
  return data;
}

export async function blockConversation(id) {
  const { data } = await axios.patch(`/conversations/${id}/block`);
  return data;
}

export async function hideConversation(id) {
  const { data } = await axios.delete(`/conversations/${id}/hide`);
  return data;
}
