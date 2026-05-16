import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthContext } from '../hooks/useAuth.js';
import { exchangeKeys, verifyKeys } from '../api/cryptoApi.js';
import { CryptoContext } from './cryptoStore.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function exportPublicKey(key) {
  const jwk = await crypto.subtle.exportKey('jwk', key);
  return btoa(JSON.stringify(jwk));
}

async function importPublicKey(publicKey) {
  return crypto.subtle.importKey('jwk', JSON.parse(atob(publicKey)), { name: 'ECDH', namedCurve: 'P-256' }, true, []);
}

async function deriveAesKey(privateKey, publicKey) {
  const importedPublic = await importPublicKey(publicKey);
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: importedPublic },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function CryptoProvider({ children }) {
  const { user } = useAuthContext();
  const [identity, setIdentity] = useState(null);
  const [conversationKeys, setConversationKeys] = useState({});

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!user?.id || !crypto?.subtle) return;
      const storageKey = `tv:crypto:${user.id}`;
      const existing = window.localStorage.getItem(storageKey);
      if (existing) {
        const parsed = JSON.parse(existing);
        const privateKey = await crypto.subtle.importKey('jwk', parsed.privateJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
        const publicKey = await crypto.subtle.importKey('jwk', parsed.publicJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
        if (!cancelled) setIdentity({ privateKey, publicKey, publicKeyString: btoa(JSON.stringify(parsed.publicJwk)), fingerprint: parsed.fingerprint });
        return;
      }
      const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
      const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
      const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
      const publicKeyString = btoa(JSON.stringify(publicJwk));
      const fingerprint = await sha256Hex(publicKeyString);
      window.localStorage.setItem(storageKey, JSON.stringify({ privateJwk, publicJwk, fingerprint }));
      if (!cancelled) setIdentity({ privateKey: pair.privateKey, publicKey: pair.publicKey, publicKeyString, fingerprint });
    }
    init();
    return () => { cancelled = true; };
  }, [user?.id]);

  const publishKey = useCallback(async (conversationId) => {
    if (!identity || !conversationId) return null;
    return exchangeKeys({ conversationId, publicKey: identity.publicKeyString, keyFingerprint: identity.fingerprint });
  }, [identity]);

  const loadConversationKeys = useCallback(async (conversationId) => {
    if (!conversationId) return [];
    const data = await verifyKeys(conversationId);
    setConversationKeys((current) => ({ ...current, [conversationId]: data.keys || [] }));
    return data.keys || [];
  }, []);

  const encryptForConversation = useCallback(async (conversationId, plaintext) => {
    if (!identity) throw new Error('Encryption identity is not ready');
    let keys = conversationKeys[conversationId] || await loadConversationKeys(conversationId);
    const peer = keys.find((key) => String(key.user_id) !== String(user?.id));
    const publicKey = peer?.public_key || identity.publicKeyString;
    const aesKey = await deriveAesKey(identity.privateKey, publicKey);
    const ivBytes = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivBytes }, aesKey, encoder.encode(plaintext));
    return { encryptedContent: bytesToBase64(encrypted), iv: bytesToBase64(ivBytes), salt: bytesToBase64(crypto.getRandomValues(new Uint8Array(16))) };
  }, [conversationKeys, identity, loadConversationKeys, user?.id]);

  const decryptMessage = useCallback(async (conversationId, message) => {
    if (!identity || !message?.encrypted_content) return '';
    try {
      let keys = conversationKeys[conversationId] || await loadConversationKeys(conversationId);
      const senderKey = keys.find((key) => String(key.user_id) === String(message.sender_id));
      const publicKey = senderKey?.public_key || identity.publicKeyString;
      const aesKey = await deriveAesKey(identity.privateKey, publicKey);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(message.iv) }, aesKey, base64ToBytes(message.encrypted_content));
      return decoder.decode(decrypted);
    } catch {
      return '[Encrypted message unavailable on this device]';
    }
  }, [conversationKeys, identity, loadConversationKeys]);

  const value = useMemo(() => ({ identity, conversationKeys, publishKey, loadConversationKeys, encryptForConversation, decryptMessage }), [conversationKeys, decryptMessage, encryptForConversation, identity, loadConversationKeys, publishKey]);
  return <CryptoContext.Provider value={value}>{children}</CryptoContext.Provider>;
}
