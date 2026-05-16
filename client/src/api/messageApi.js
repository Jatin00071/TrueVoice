import axios from './axiosInstance.js';

export async function getMessages(conversationId, params = {}) {
  const { data } = await axios.get(`/conversations/${conversationId}/messages`, { params });
  return data;
}

export async function sendMessage(payload) {
  const { data } = await axios.post('/messages', payload);
  return data;
}

export async function editMessage(id, payload) {
  const { data } = await axios.put(`/messages/${id}`, payload);
  return data;
}

export async function deleteMessage(id) {
  const { data } = await axios.delete(`/messages/${id}`);
  return data;
}

export async function markMessageRead(id) {
  const { data } = await axios.put(`/messages/${id}/read`);
  return data;
}
