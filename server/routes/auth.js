'use strict';

const express = require('express');
const { db } = require('../db');
const {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
} = require('../auth');
const { validateUserInput, asString } = require('../validate');

const router = express.Router();

const loginAttempts = new Map();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

function isRateLimited(key) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(key, { count: 0, resetAt: now + WINDOW_MS });
    return false;
  }
  if (entry.count >= MAX_ATTEMPTS) return true;
  entry.count += 1;
  return false;
}

function clearAttempts(key) {
  loginAttempts.delete(key);
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttempts) {
    if (entry.resetAt < now) loginAttempts.delete(key);
  }
}, WINDOW_MS).unref();

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

router.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

router.post('/login', async (req, res, next) => {
  try {
    const email = asString(req.body.email).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const rateKey = `${req.ip}|${email}`;

    if (isRateLimited(rateKey)) {
      return res
        .status(429)
        .json({ error: 'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.' });
    }

    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi.' });
    }

    const user = db
      .prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE')
      .get(email);

    const passwordOk = user
      ? await verifyPassword(password, user.password_hash)
      : false;

    if (!user || !passwordOk) {
      return res.status(401).json({ error: 'Email atau password salah.' });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: 'Akun Anda telah dinonaktifkan oleh admin.' });
    }

    clearAttempts(rateKey);
    createSession(req, res, user.id);
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/register', async (req, res, next) => {
  try {
    const { errors, data } = validateUserInput(
      { ...req.body, role: 'buyer' },
      { requirePassword: true }
    );
    if (!data.name || !data.email) {
      errors.push('Nama dan email wajib diisi.');
    }
    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0], errors });
    }

    const exists = db
      .prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE')
      .get(data.email);
    if (exists) {
      return res.status(409).json({ error: 'Email sudah terdaftar.' });
    }

    const passwordHash = await hashPassword(data.password);
    const info = db
      .prepare(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'buyer')"
      )
      .run(data.name, data.email, passwordHash);

    const user = db
      .prepare('SELECT id, name, email, role FROM users WHERE id = ?')
      .get(Number(info.lastInsertRowid));

    createSession(req, res, user.id);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

module.exports = router;
