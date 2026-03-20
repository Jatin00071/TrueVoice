import { useContext } from 'react';
import { AuthContext } from '../context/authStore.js';

export function useAuthContext() {
  return useContext(AuthContext);
}
