# TrueVoice Messaging Service

Messaging is implemented as an additive subsystem. It creates only new database tables and exposes new `/api/v1/conversations`, `/api/v1/messages`, `/api/v1/attachments`, and `/api/v1/keys` endpoints.

The server stores encrypted message envelopes and attachment metadata only. Message plaintext encryption/decryption is handled in the browser with Web Crypto.

## Runtime flow

1. A user starts or opens a conversation.
2. The client publishes its conversation public key through `/api/v1/keys/exchange`.
3. The client encrypts message content with AES-GCM using an ECDH-derived shared key.
4. The server validates the encrypted envelope shape and stores `encrypted_content`, `iv`, and `salt`.
5. Socket.io emits additive messaging events such as `message:new`, `message:typing`, and `message:read`.

## Storage

Local encrypted uploads are stored under `server/uploads/messages` by default. Configure `MESSAGE_STORAGE_DIR` for a different local path. S3/MinIO can be layered behind `server/services/mediaService.js` later without changing the API contract.
