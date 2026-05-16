# Messaging API

## Conversations

- `GET /api/v1/conversations`
- `GET /api/v1/conversations/:id`
- `POST /api/v1/conversations/:userId`
- `DELETE /api/v1/conversations/:id`
- `GET /api/v1/conversations/:id/messages?page=1&limit=50`

## Messages

- `POST /api/v1/messages`
- `PUT /api/v1/messages/:id`
- `DELETE /api/v1/messages/:id`
- `PUT /api/v1/messages/:id/read`

Encrypted message body:

```json
{
  "conversationId": 1,
  "encryptedContent": "base64-ciphertext",
  "iv": "base64-iv",
  "salt": "base64-salt"
}
```

## Attachments

- `POST /api/v1/messages/upload` multipart form fields: `messageId`, `file`
- `GET /api/v1/attachments/:id/download`
- `GET /api/v1/attachments/:id/thumbnail`

## Keys

- `GET /api/v1/keys/public/:userId`
- `POST /api/v1/keys/exchange`
- `GET /api/v1/keys/verify/:conversationId`

## Socket events

Client may emit: `message:send`, `message:typing`, `message:read`, `keys:exchange`, `conversation:archived`.

Server may emit: `message:new`, `message:sent`, `message:edited`, `message:deleted`, `message:read`, `message:notification`, `message:error`, `keys:updated`, `conversation:archived`.
