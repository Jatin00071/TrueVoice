export async function testE2EEncryption(cryptoContext, conversationId, testMessage = 'TrueVoice encryption test') {
  const started = performance.now();
  const result = {
    ok: false,
    conversationId,
    identityReady: Boolean(cryptoContext?.identity),
    steps: [],
    durationMs: 0,
    error: null
  };

  try {
    if (!cryptoContext?.identity) throw new Error('Encryption identity is not ready');
    result.steps.push('identity-ready');

    await cryptoContext.publishKey(conversationId);
    result.steps.push('published-own-key');

    const keys = await cryptoContext.loadConversationKeys(conversationId);
    result.steps.push(`loaded-${keys.length}-keys`);

    const peerKey = keys.find((key) => String(key.user_id) !== String(cryptoContext.debugState?.userId));
    if (!peerKey?.user_id) {
      throw new Error('No peer key is available for this conversation test');
    }

    const envelope = await cryptoContext.encryptForConversation(conversationId, testMessage);
    result.steps.push('encrypted');

    // Synthetic inbound message: decrypt with our private key + peer public key.
    const message = {
      id: 'debug-round-trip-test',
      sender_id: peerKey.user_id,
      encrypted_content: envelope.encryptedContent,
      iv: envelope.iv,
      salt: envelope.salt
    };

    const decrypted = await cryptoContext.decryptMessage(conversationId, message);
    result.steps.push('decrypted');
    result.ok = decrypted === testMessage;
    result.decrypted = decrypted;
    if (!result.ok) throw new Error('Round-trip decrypted text did not match original text');
  } catch (error) {
    result.error = error?.message || String(error);
  } finally {
    result.durationMs = Math.round(performance.now() - started);
  }

  console.debug('[CryptoDebug] E2E test result', result);
  return result;
}

if (typeof window !== 'undefined') {
  window.testE2EEncryption = testE2EEncryption;
}
