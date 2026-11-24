'use strict';

const crypto = require('crypto');

// Read configuration. APP_SIGNING_SECRET is optional: without it the session cookie is signed with a
// random key made at start (sessions then end when the app restarts). The value is never printed or logged.
function loadConfig(env = process.env) {
  const secret = (env.APP_SIGNING_SECRET || '').trim();
  if (!secret) console.log('APP_SIGNING_SECRET is not set: using a random signing key for this run.');
  return {
    port: Number(env.PORT) || 3000,
    databaseUrl: env.DATABASE_URL || 'postgres://app:app@localhost:5432/app',
    signingSecret: secret || crypto.randomBytes(32).toString('hex'),
  };
}

module.exports = { loadConfig };
