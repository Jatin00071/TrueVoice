import { useCallback, useState } from 'react';
import { uploadMessageAttachment } from '../api/mediaApi.js';

const LIMITS = {
  image: 10 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  file: 25 * 1024 * 1024
};

function getLimit(file) {
  if (file?.type?.startsWith('image/')) return LIMITS.image;
  if (file?.type?.startsWith('video/')) return LIMITS.video;
  return LIMITS.file;
}

export function useMediaUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const upload = useCallback(async ({ messageId, file }) => {
    setError('');
    if (!file) throw new Error('Choose a file first.');
    if (file.size > getLimit(file)) throw new Error('File exceeds the message attachment limit.');
    setIsUploading(true);
    try {
      return await uploadMessageAttachment({ messageId, file });
    } catch (err) {
      const message = err?.response?.data?.message || err.message || 'Unable to upload attachment.';
      setError(message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return { upload, isUploading, error };
}
