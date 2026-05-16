import axios from './axiosInstance.js';

export async function getPublicKey(userId) {
  const { data } = await axios.get(`/keys/public/${userId}`);
  return data;
}

export async function exchangeKeys(payload) {
  const { data } = await axios.post('/keys/exchange', payload);
  return data;
}

export async function verifyKeys(conversationId) {
  const { data } = await axios.get(`/keys/verify/${conversationId}`);
  return data;
}
