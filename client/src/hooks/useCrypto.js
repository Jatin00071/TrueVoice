import { useContext, useEffect } from 'react';
import { CryptoContext } from '../context/cryptoStore.js';

export function useCrypto() {
  return useContext(CryptoContext);
}

export function useCryptoDebug(label = 'CryptoDebug') {
  const cryptoContext = useCrypto();

  useEffect(() => {
    if (!cryptoContext) {
      console.debug(`[${label}] Crypto context unavailable`);
      return;
    }

    console.debug(`[${label}] state`, cryptoContext.debugState || {
      identityReady: Boolean(cryptoContext.identity),
      conversationKeys: cryptoContext.conversationKeys
    });
  }, [cryptoContext, label]);

  return cryptoContext?.debugState || null;
}
