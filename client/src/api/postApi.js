import api from './axiosInstance.js';

export async function createPost(formData) {
  const res = await api.post('/posts', formData);
  return res.data;
}

export async function getFeed(cursor, limit = 10) {
  const res = await api.get('/posts/feed', { params: { cursor, limit } });
  return res.data;
}

export async function getDiscover(cursor, limit = 10) {
  const res = await api.get('/posts/discover', { params: { cursor, limit } });
  return res.data;
}

export async function getPost(id) {
  const res = await api.get(`/posts/${id}`);
  return res.data;
}

export async function updatePost(id, content) {
  const res = await api.put(`/posts/${id}`, { content });
  return res.data;
}

export async function deletePost(id) {
  const res = await api.delete(`/posts/${id}`);
  return res.data;
}

export async function getOriginChain(id) {
  const res = await api.get(`/posts/${id}/origin-chain`);
  return res.data;
}

export async function likePost(id) {
  const res = await api.post(`/posts/${id}/like`);
  return res.data;
}

export async function getComments(postId) {
  const res = await api.get(`/posts/${postId}/comments`);
  return res.data;
}

export async function addComment(postId, content) {
  const res = await api.post(`/posts/${postId}/comments`, { content });
  return res.data;
}

export async function deleteComment(postId, commentId) {
  const res = await api.delete(`/posts/${postId}/comments/${commentId}`);
  return res.data;
}

export async function getPendingComments(postId) {
  const res = await api.get(`/posts/${postId}/comments/pending`);
  return res.data;
}

export async function approveComment(postId, commentId) {
  const res = await api.post(`/posts/${postId}/comments/${commentId}/approve`);
  return res.data;
}
