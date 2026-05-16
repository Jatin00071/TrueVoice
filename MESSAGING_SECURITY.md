# Messaging Security Notes

- Message plaintext is never sent to the server by the intended client flow.
- The server validates encrypted envelope metadata only.
- Client identity keys use browser Web Crypto ECDH P-256 and are stored per user in `localStorage`.
- Message encryption uses AES-256-GCM with a unique random IV per message.
- Attachments are expected to be encrypted by the client before upload; the server stores opaque attachment bytes.
- Key fingerprints are SHA-256 hashes of exported public key material.

## Production hardening

Before enabling broadly, add malware scanning for uploaded encrypted blobs, S3/MinIO signed URL storage, rate limits for `/messages`, and a client-side key backup/recovery UX.
