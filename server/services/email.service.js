const nodemailer = require('nodemailer');
const fetch = require('node-fetch');
const dns = require('dns').promises;
const net = require('net');

let transportCache = null;
let transportPromise = null;

function isConfigured() {
  return Boolean(cleanEnvValue(process.env.SENDGRID_API_KEY))
    || Boolean(process.env.SMTP_URL)
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

function formatMailInfo(info) {
  return {
    messageId: info?.messageId,
    accepted: info?.accepted,
    rejected: info?.rejected,
    pending: info?.pending,
    response: info?.response
  };
}

function shouldUseSendGrid() {
  return Boolean(cleanEnvValue(process.env.SENDGRID_API_KEY));
}

async function sendWithSendGrid({ to, subject, text, html }) {
  const apiKey = cleanEnvValue(process.env.SENDGRID_API_KEY);
  const from = cleanEnvValue(process.env.SENDGRID_FROM)
    || cleanEnvValue(process.env.MAIL_FROM)
    || 'TrueVoice <no-reply@truevoice.local>';
  const match = from.match(/^(.*)<([^>]+)>$/);
  const fromEmail = match ? match[2].trim() : from;
  const fromName = match ? match[1].trim().replace(/^['"]|['"]$/g, '') : undefined;

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: to }]
        }
      ],
      from: {
        email: fromEmail,
        ...(fromName ? { name: fromName } : {})
      },
      subject,
      content: [
        {
          type: 'text/plain',
          value: text
        },
        {
          type: 'text/html',
          value: html
        }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.json().catch(async () => ({ message: await response.text() }));
    const message = body?.errors?.[0]?.message || body?.message || `SendGrid API request failed with ${response.status}`;
    const error = new Error(message);
    error.code = 'SENDGRID_API_ERROR';
    error.responseCode = response.status;
    error.response = body;
    throw error;
  }

  // eslint-disable-next-line no-console
  console.log('[Mail] SendGrid email accepted:', {
    messageId: response.headers.get('x-message-id'),
    to,
    subject
  });

  return {
    delivered: true,
    mode: 'sendgrid'
  };
}

function mailHeaders() {
  const messageStream = cleanEnvValue(process.env.POSTMARK_MESSAGE_STREAM || process.env.SMTP_MESSAGE_STREAM);

  return {
    ...(messageStream ? { 'X-PM-Message-Stream': messageStream } : {})
  };
}

async function resolveSmtpHost(host, family) {
  const smtpHost = cleanEnvValue(host);

  if (family !== 4 || net.isIP(smtpHost)) {
    return {
      host: smtpHost,
      servername: net.isIP(smtpHost) ? cleanEnvValue(process.env.SMTP_SERVERNAME) : smtpHost
    };
  }

  const addresses = await dns.resolve4(smtpHost);
  if (!addresses.length) {
    throw new Error(`No IPv4 address found for SMTP host ${smtpHost}`);
  }

  return {
    host: addresses[0],
    servername: smtpHost
  };
}

async function createTransportContext() {
  if (!isConfigured()) return null;

  const from = cleanEnvValue(process.env.MAIL_FROM) || cleanEnvValue(process.env.SMTP_USER) || 'TrueVoice <no-reply@truevoice.local>';
  const timeoutMs = Number(process.env.SMTP_TIMEOUT_MS || 8000);
  const family = Number(process.env.SMTP_FAMILY || 4);

  if (process.env.SMTP_URL) {
    return {
      from,
      transport: nodemailer.createTransport(cleanEnvValue(process.env.SMTP_URL), {
        connectionTimeout: timeoutMs,
        greetingTimeout: timeoutMs,
        socketTimeout: timeoutMs
      })
    };
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  const resolved = await resolveSmtpHost(process.env.SMTP_HOST, family);

  return {
    from,
    transport: nodemailer.createTransport({
      host: resolved.host,
      port,
      secure,
      servername: resolved.servername,
      auth: {
        user: cleanEnvValue(process.env.SMTP_USER),
        pass: cleanEnvValue(process.env.SMTP_PASS)
      },
      connectionTimeout: timeoutMs,
      greetingTimeout: timeoutMs,
      socketTimeout: timeoutMs,
      tls: resolved.servername
        ? {
            servername: resolved.servername
          }
        : undefined
    })
  };
}

async function getTransportContext() {
  if (transportCache) return transportCache;
  if (transportPromise) return transportPromise;

  transportPromise = createTransportContext()
    .then((context) => {
      transportCache = context;
      return context;
    })
    .finally(() => {
      transportPromise = null;
    });

  return transportPromise;
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

  if (shouldUseSendGrid()) {
    return sendWithSendGrid({
      to,
      subject: 'Verify your TrueVoice email',
      text,
      html
    });
  }

  const transportContext = await getTransportContext();
  const info = await transportContext.transport.sendMail({
    from: transportContext.from,
    to,
    subject: 'Verify your TrueVoice email',
    headers: mailHeaders(),
    text,
    html
  });
  // eslint-disable-next-line no-console
  console.log('[Mail] Verification email accepted:', formatMailInfo(info));

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

  if (shouldUseSendGrid()) {
    return sendWithSendGrid({
      to,
      subject: 'Reset your TrueVoice password',
      text,
      html
    });
  }

  const transportContext = await getTransportContext();
  const info = await transportContext.transport.sendMail({
    from: transportContext.from,
    to,
    subject: 'Reset your TrueVoice password',
    headers: mailHeaders(),
    text,
    html
  });
  // eslint-disable-next-line no-console
  console.log('[Mail] Password reset email accepted:', formatMailInfo(info));

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
