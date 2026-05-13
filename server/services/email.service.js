const nodemailer = require('nodemailer');

let transportCache = null;

function isConfigured() {
  return Boolean(process.env.SMTP_URL)
    || Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function cleanEnvValue(value) {
  return String(value || '').trim().replace(/^['"]|['"]$/g, '');
}

function formatMailError(error) {
  return {
    message: error?.message || 'Unknown mail error',
    code: error?.code,
    command: error?.command,
    responseCode: error?.responseCode,
    response: error?.response
  };
}

function getTransportContext() {
  if (transportCache) return transportCache;
  if (!isConfigured()) return null;

  const from = cleanEnvValue(process.env.MAIL_FROM) || cleanEnvValue(process.env.SMTP_USER) || 'TrueVoice <no-reply@truevoice.local>';
  const timeoutMs = Number(process.env.SMTP_TIMEOUT_MS || 8000);
  const family = Number(process.env.SMTP_FAMILY || 4);

  if (process.env.SMTP_URL) {
    transportCache = {
      from,
      transport: nodemailer.createTransport(cleanEnvValue(process.env.SMTP_URL), {
        family,
        connectionTimeout: timeoutMs,
        greetingTimeout: timeoutMs,
        socketTimeout: timeoutMs
      })
    };
    return transportCache;
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

  transportCache = {
    from,
    transport: nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      family,
      auth: {
        user: cleanEnvValue(process.env.SMTP_USER),
        pass: cleanEnvValue(process.env.SMTP_PASS)
      },
      connectionTimeout: timeoutMs,
      greetingTimeout: timeoutMs,
      socketTimeout: timeoutMs
    })
  };

  return transportCache;
}

async function sendVerificationEmail({ to, username, verificationUrl }) {
  const text = [
    `Hi ${username || 'there'},`,
    '',
    'Welcome to TrueVoice.',
    'Verify your email address by opening the link below:',
    verificationUrl,
    '',
    'If you did not create this account, you can ignore this email.'
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1a1a2e;">
      <p>Hi ${username || 'there'},</p>
      <p>Welcome to <strong>TrueVoice</strong>.</p>
      <p>Please verify your email address to activate your account.</p>
      <p>
        <a
          href="${verificationUrl}"
          style="display: inline-block; padding: 12px 18px; border-radius: 10px; background: #1a1a2e; color: #ffffff; text-decoration: none;"
        >
          Verify email
        </a>
      </p>
      <p style="word-break: break-all; color: #6b7280;">${verificationUrl}</p>
      <p>If you did not create this account, you can ignore this email.</p>
    </div>
  `;

  if (!isConfigured()) {
    // eslint-disable-next-line no-console
    console.log(`[Mail] Verification preview for ${to}: ${verificationUrl}`);
    return {
      delivered: false,
      mode: 'preview',
      previewUrl: verificationUrl
    };
  }

  const transportContext = getTransportContext();
  await transportContext.transport.sendMail({
    from: transportContext.from,
    to,
    subject: 'Verify your TrueVoice email',
    text,
    html
  });

  return {
    delivered: true,
    mode: 'smtp'
  };
}

async function sendPasswordResetEmail({ to, username, resetUrl }) {
  const text = [
    `Hi ${username || 'there'},`,
    '',
    'We received a request to reset your TrueVoice password.',
    'Open the link below to choose a new password:',
    resetUrl,
    '',
    'If you did not request this, you can ignore this email.'
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1a1a2e;">
      <p>Hi ${username || 'there'},</p>
      <p>We received a request to reset your <strong>TrueVoice</strong> password.</p>
      <p>Use the button below to choose a new password.</p>
      <p>
        <a
          href="${resetUrl}"
          style="display: inline-block; padding: 12px 18px; border-radius: 10px; background: #1a1a2e; color: #ffffff; text-decoration: none;"
        >
          Reset password
        </a>
      </p>
      <p style="word-break: break-all; color: #6b7280;">${resetUrl}</p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `;

  if (!isConfigured()) {
    // eslint-disable-next-line no-console
    console.log(`[Mail] Password reset preview for ${to}: ${resetUrl}`);
    return {
      delivered: false,
      mode: 'preview',
      previewUrl: resetUrl
    };
  }

  const transportContext = getTransportContext();
  await transportContext.transport.sendMail({
    from: transportContext.from,
    to,
    subject: 'Reset your TrueVoice password',
    text,
    html
  });

  return {
    delivered: true,
    mode: 'smtp'
  };
}

module.exports = {
  isConfigured,
  formatMailError,
  sendVerificationEmail,
  sendPasswordResetEmail
};
