'use strict';

const express = require('express');
const { db } = require('../db');
const { requireRole, hashPassword } = require('../auth');
const {
  validateUserInput,
  validateCategoryName,
  normalizeWhatsapp,
  asString,
} = require('../validate');
const { removeUploadedImage } = require('../upload');
const { getPublicSettings } = require('./catalog');

const router = express.Router();
router.use(requireRole('admin'));

function userRow(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    is_active: Boolean(user.is_active),
    created_at: user.created_at,
    product_count: user.product_count || 0,
  };
}

router.get('/stats', (req, res) => {
  const users = db
    .prepare(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END), 0) AS admins,
        COALESCE(SUM(CASE WHEN role = 'seller' THEN 1 ELSE 0 END), 0) AS sellers,
        COALESCE(SUM(CASE WHEN role = 'buyer' THEN 1 ELSE 0 END), 0) AS buyers,
        COALESCE(SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END), 0) AS inactive
      FROM users
    `)
    .get();
  const catalog = db
    .prepare(`
      SELECT COUNT(*) AS total_products, COALESCE(SUM(stock), 0) AS total_stock
      FROM products
    `)
    .get();
  const categories = db
    .prepare('SELECT COUNT(*) AS total FROM categories')
    .get();

  res.json({
    stats: {
      users,
      products: catalog.total_products,
      total_stock: catalog.total_stock,
      categories: categories.total,
    },
    store: getPublicSettings(),
  });
});

router.get('/users', (req, res) => {
  const users = db
    .prepare(`
      SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at,
             COUNT(p.id) AS product_count
      FROM users u
      LEFT JOIN products p ON p.seller_id = u.id
      GROUP BY u.id
      ORDER BY u.role ASC, u.name COLLATE NOCASE ASC
    `)
    .all();
  res.json({ users: users.map(userRow) });
});

router.post('/users', async (req, res, next) => {
  try {
    const { errors, data } = validateUserInput(req.body);
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
        'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)'
      )
      .run(data.name, data.email, passwordHash, data.role, data.isActive ? 1 : 0);

    const user = db
      .prepare('SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?')
      .get(Number(info.lastInsertRowid));
    res.status(201).json({ user: userRow(user) });
  } catch (error) {
    next(error);
  }
});

router.put('/users/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  }

  const { errors, data } = validateUserInput(req.body, { requirePassword: false });
  if (errors.length > 0) {
    return res.status(400).json({ error: errors[0], errors });
  }

  if (id === req.user.id) {
    if (data.role !== 'admin') {
      return res.status(400).json({ error: 'Anda tidak dapat mengubah peran akun sendiri.' });
    }
    if (!data.isActive) {
      return res.status(400).json({ error: 'Anda tidak dapat menonaktifkan akun sendiri.' });
    }
  }

  const duplicate = db
    .prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE AND id != ?')
    .get(data.email, id);
  if (duplicate) {
    return res.status(409).json({ error: 'Email sudah dipakai pengguna lain.' });
  }

  db.prepare(
    'UPDATE users SET name = ?, email = ?, role = ?, is_active = ? WHERE id = ?'
  ).run(data.name, data.email, data.role, data.isActive ? 1 : 0, id);

  if (!data.isActive) {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  }

  const user = db
    .prepare('SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?')
    .get(id);
  res.json({ user: userRow(user) });
});

router.put('/users/:id/password', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }

    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (password.length < 8 || password.length > 200) {
      return res.status(400).json({ error: 'Password baru harus 8-200 karakter.' });
    }

    const passwordHash = await hashPassword(password);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
    if (id !== req.user.id) {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/users/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (id === req.user.id) {
    return res.status(400).json({ error: 'Anda tidak dapat menghapus akun sendiri.' });
  }

  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  }

  const images = db
    .prepare('SELECT image_url FROM products WHERE seller_id = ?')
    .all(id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  for (const row of images) removeUploadedImage(row.image_url);

  res.json({ ok: true });
});

router.get('/products', (req, res) => {
  const products = db
    .prepare(`
      SELECT p.id, p.name, p.price, p.stock, p.featured, p.image_url,
             c.name AS category_name, u.name AS seller_name, u.id AS seller_id
      FROM products p
      JOIN categories c ON c.id = p.category_id
      JOIN users u ON u.id = p.seller_id
      ORDER BY p.name COLLATE NOCASE ASC
    `)
    .all()
    .map((row) => ({ ...row, featured: Boolean(row.featured) }));
  res.json({ products });
});

router.get('/categories', (req, res) => {
  const categories = db
    .prepare(`
      SELECT c.id, c.name, COUNT(p.id) AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name COLLATE NOCASE ASC
    `)
    .all();
  res.json({ categories });
});

router.post('/categories', (req, res) => {
  const { error, name } = validateCategoryName(req.body.name);
  if (error) return res.status(400).json({ error });

  const exists = db
    .prepare('SELECT id FROM categories WHERE name = ? COLLATE NOCASE')
    .get(name);
  if (exists) {
    return res.status(409).json({ error: 'Kategori dengan nama tersebut sudah ada.' });
  }

  const info = db
    .prepare('INSERT INTO categories (name, created_by) VALUES (?, ?)')
    .run(name, req.user.id);
  const category = db
    .prepare('SELECT id, name FROM categories WHERE id = ?')
    .get(Number(info.lastInsertRowid));
  res.status(201).json({ category: { ...category, product_count: 0 } });
});

router.delete('/categories/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(id);
  if (!category) {
    return res.status(404).json({ error: 'Kategori tidak ditemukan.' });
  }

  const used = db
    .prepare('SELECT COUNT(*) AS total FROM products WHERE category_id = ?')
    .get(id).total;
  if (used > 0) {
    return res.status(409).json({
      error: `Kategori masih dipakai oleh ${used} produk dan tidak bisa dihapus.`,
    });
  }

  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.json({ ok: true });
});

router.put('/settings', (req, res) => {
  const storeName = asString(req.body.store_name);
  const address = asString(req.body.store_address);
  const hours = asString(req.body.store_open_hours);
  const { error, digits } = normalizeWhatsapp(req.body.whatsapp_number);

  if (storeName.length < 2 || storeName.length > 80) {
    return res.status(400).json({ error: 'Nama toko harus 2-80 karakter.' });
  }
  if (error) return res.status(400).json({ error });
  if (address.length > 200) {
    return res.status(400).json({ error: 'Alamat maksimal 200 karakter.' });
  }
  if (hours.length > 120) {
    return res.status(400).json({ error: 'Jam buka maksimal 120 karakter.' });
  }

  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  db.transaction(() => {
    upsert.run('store_name', storeName);
    upsert.run('whatsapp_number', digits);
    upsert.run('store_address', address);
    upsert.run('store_open_hours', hours);
  })();

  res.json({ store: getPublicSettings() });
});

module.exports = router;
