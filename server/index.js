'use strict';

const path = require('path');
const express = require('express');
const { db } = require('./db');
const {
  sessionMiddleware,
  requireRole,
  cleanupSessions,
} = require('./auth');
const { ensureSeed } = require('./seed');
const { upload } = require('./upload');

const authRoutes = require('./routes/auth');
const catalogRoutes = require('./routes/catalog');
const sellerRoutes = require('./routes/seller');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "connect-src 'self'",
      "font-src 'self'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
    ].join('; ')
  );
  next();
});

app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));
app.use(sessionMiddleware);

// Basic CSRF defence for state-changing API requests: reject cross-site origins.
app.use('/api', (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) {
        return res.status(403).json({ error: 'Permintaan lintas situs ditolak.' });
      }
    } catch {
      return res.status(403).json({ error: 'Origin tidak valid.' });
    }
  } else if (req.headers['sec-fetch-site'] === 'cross-site') {
    return res.status(403).json({ error: 'Permintaan lintas situs ditolak.' });
  }
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api', catalogRoutes.router);
app.use('/api/seller', sellerRoutes);
app.use('/api/admin', adminRoutes);

app.post(
  '/api/uploads',
  requireRole('admin', 'seller'),
  (req, res, next) => {
    upload.single('image')(req, res, (error) => {
      if (error) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Ukuran gambar maksimal 4 MB.' });
        }
        if (error.message === 'INVALID_IMAGE_TYPE') {
          return res
            .status(400)
            .json({ error: 'Format gambar harus JPG, PNG, atau WebP.' });
        }
        return next(error);
      }
      if (!req.file) {
        return res.status(400).json({ error: 'Pilih file gambar terlebih dahulu.' });
      }
      res.status(201).json({ url: `/uploads/${req.file.filename}` });
    });
  }
);

app.use(
  '/uploads',
  express.static(UPLOAD_DIR, {
    maxAge: '7d',
    immutable: false,
    fallthrough: true,
  })
);

function dashboardFor(role) {
  if (role === 'admin') return '/admin';
  if (role === 'seller') return '/seller';
  return '/';
}

app.get('/login', (req, res) => {
  if (req.user) return res.redirect(dashboardFor(req.user.role));
  res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
});

app.get('/admin', (req, res) => {
  if (!req.user) return res.redirect('/login?next=/admin');
  if (req.user.role !== 'admin') return res.redirect(dashboardFor(req.user.role));
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

app.get('/seller', (req, res) => {
  if (!req.user) return res.redirect('/login?next=/seller');
  if (req.user.role !== 'seller') return res.redirect(dashboardFor(req.user.role));
  res.sendFile(path.join(PUBLIC_DIR, 'seller.html'));
});

app.use(
  express.static(PUBLIC_DIR, {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
});

app.use((error, req, res, next) => {
  console.error(`[${new Date().toISOString()}]`, error);
  if (res.headersSent) return next(error);
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Permintaan terlalu besar.' });
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'Format permintaan tidak valid.' });
  }
  res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
});

async function start() {
  await ensureSeed();
  cleanupSessions();
  setInterval(cleanupSessions, 60 * 60 * 1000).unref();

  const server = app.listen(PORT, () => {
    console.log(`GeprekOn berjalan di http://localhost:${PORT}`);
    console.log(`Database SQLite: ${db.name}`);
  });

  const shutdown = () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  start().catch((error) => {
    console.error('Gagal menjalankan server:', error);
    process.exit(1);
  });
}

module.exports = app;
