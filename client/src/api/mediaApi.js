import axios from './axiosInstance.js';

export async function uploadMessageAttachment({ messageId, file }) {
  const form = new FormData();
  form.append('messageId', messageId);
  form.append('file', file);
  const { data } = await axios.post('/messages/upload', form);
  return data;
}

export function attachmentDownloadUrl(id) {
  const base = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/v1` : 'https://truevoice-9qth.onrender.com/api/v1';
  return `${base}/attachments/${id}/download`;
}

export function attachmentThumbnailUrl(id) {
  const base = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/v1` : 'https://truevoice-9qth.onrender.com/api/v1';
  return `${base}/attachments/${id}/thumbnail`;
}
