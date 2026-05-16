import { useContext } from 'react';
import { CryptoContext } from '../context/cryptoStore.js';

export function useCrypto() {
  return useContext(CryptoContext);
}
