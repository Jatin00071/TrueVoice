import axios from './axiosInstance.js';

export async function getConversations(params = {}) {
  const { data } = await axios.get('/conversations', { params });
  return data;
}

export async function getConversation(id) {
  const { data } = await axios.get(`/conversations/${id}`);
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
