import { useContext } from 'react';
import { SocketContext } from '../context/socketStore.js';

export function useSocketContext() {
  return useContext(SocketContext);
}
