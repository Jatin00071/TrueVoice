import { useCallback } from 'react';
import { archiveConversation, getConversation, getConversations, startConversation } from '../api/conversationApi.js';

export function useConversations() {
  const list = useCallback((params) => getConversations(params), []);
  const get = useCallback((id) => getConversation(id), []);
  const start = useCallback((userId) => startConversation(userId), []);
  const archive = useCallback((id) => archiveConversation(id), []);
  return { list, get, start, archive };
}
