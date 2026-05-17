import axios from './axiosInstance.js';

export async function getPublicKey(userId) {
  try {
    const { data } = await axios.get(`/keys/public/${userId}`);
    return data;
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error(`User ${userId} has not initialized encryption`);
    }
    throw error;
  }
}

export async function exchangeKeys(payload) {
  const { data } = await axios.post('/keys/exchange', payload);
  return data;
}

export async function publishIdentityKey(payload) {
  const { data } = await axios.post('/keys/identity', payload);
  return data;
}

export async function verifyKeys(conversationId) {
  const { data } = await axios.get(`/keys/verify/${conversationId}`);
  return data;
}
