'use strict';

const crypto = require('crypto');
const { promisify } = require('util');
const { db } = require('./db');

const scrypt = promisify(crypto.scrypt);
const SCRYPT_KEYLEN = 64;
const SESSION_COOKIE = 'geprekon_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  if (salt.length === 0 || expected.length !== SCRYPT_KEYLEN) return false;
  const actual = await scrypt(password, salt, SCRYPT_KEYLEN);
  return crypto.timingSafeEqual(actual, expected);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }
  return cookies;
}

function setSessionCookie(req, res, token) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const attrs = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (secure) attrs.push('Secure');
  res.append('Set-Cookie', attrs.join('; '));
}

function clearSessionCookie(res) {
  res.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

function createSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  db.prepare(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)'
  ).run(hashToken(token), userId, expiresAt);
  setSessionCookie(req, res, token);
  return token;
}

function destroySession(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  }
  clearSessionCookie(res);
}

const selectSessionUser = db.prepare(`
  SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at
  FROM sessions s
  JOIN users u ON u.id = s.user_id
  WHERE s.token_hash = ? AND s.expires_at > ?
`);

function sessionMiddleware(req, res, next) {
  req.user = null;
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) {
    const user = selectSessionUser.get(hashToken(token), Date.now());
    if (user && user.is_active) {
      req.user = user;
    } else if (user && !user.is_active) {
      destroySession(req, res);
    }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Anda tidak memiliki akses ke fitur ini.' });
    }
    next();
  };
}

function cleanupSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
}

module.exports = {
  SESSION_COOKIE,
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  sessionMiddleware,
  requireAuth,
  requireRole,
  cleanupSessions,
};
