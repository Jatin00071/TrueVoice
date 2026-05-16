import { useContext } from 'react';
import { MessageContext } from '../context/messageStore.js';

export function useMessages() {
  return useContext(MessageContext);
}
