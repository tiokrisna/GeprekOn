'use strict';

const express = require('express');
const { db } = require('../db');
const { requireRole } = require('../auth');
const { validateProductInput, validateCategoryName } = require('../validate');
const { removeUploadedImage } = require('../upload');

const router = express.Router();
router.use(requireRole('seller'));

const productSelect = `
  SELECT p.*, c.name AS category_name
  FROM products p
  JOIN categories c ON c.id = p.category_id
  WHERE p.seller_id = ?
  ORDER BY p.created_at DESC, p.id DESC
`;

function mapProduct(row) {
  return { ...row, featured: Boolean(row.featured) };
}

function categoryExists(id) {
  return Boolean(db.prepare('SELECT id FROM categories WHERE id = ?').get(id));
}

router.get('/stats', (req, res) => {
  const stats = db
    .prepare(`
      SELECT
        COUNT(*) AS total_products,
        COALESCE(SUM(stock), 0) AS total_stock,
        COALESCE(SUM(CASE WHEN stock < 5 THEN 1 ELSE 0 END), 0) AS low_stock,
        COUNT(DISTINCT category_id) AS total_categories,
        COALESCE(SUM(featured), 0) AS featured_products
      FROM products
      WHERE seller_id = ?
    `)
    .get(req.user.id);
  res.json({ stats });
});

router.get('/products', (req, res) => {
  res.json({ products: db.prepare(productSelect).all(req.user.id).map(mapProduct) });
});

router.post('/products', (req, res) => {
  const { errors, data } = validateProductInput(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors[0], errors });
  }
  if (!categoryExists(data.categoryId)) {
    return res.status(400).json({ error: 'Kategori tidak ditemukan.' });
  }

  const info = db
    .prepare(`
      INSERT INTO products
        (seller_id, category_id, name, description, price, stock, image_url, featured)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      req.user.id,
      data.categoryId,
      data.name,
      data.description,
      data.price,
      data.stock,
      data.imageUrl,
      data.featured ? 1 : 0
    );

  const product = db
    .prepare(`
      SELECT p.*, c.name AS category_name
      FROM products p JOIN categories c ON c.id = p.category_id
      WHERE p.id = ?
    `)
    .get(Number(info.lastInsertRowid));

  res.status(201).json({ product: mapProduct(product) });
});

router.put('/products/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const existing = db
    .prepare('SELECT * FROM products WHERE id = ? AND seller_id = ?')
    .get(id, req.user.id);

  if (!existing) {
    return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  }

  const { errors, data } = validateProductInput(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors[0], errors });
  }
  if (!categoryExists(data.categoryId)) {
    return res.status(400).json({ error: 'Kategori tidak ditemukan.' });
  }

  db.prepare(`
    UPDATE products SET
      category_id = ?, name = ?, description = ?, price = ?, stock = ?,
      image_url = ?, featured = ?, updated_at = datetime('now')
    WHERE id = ? AND seller_id = ?
  `).run(
    data.categoryId,
    data.name,
    data.description,
    data.price,
    data.stock,
    data.imageUrl,
    data.featured ? 1 : 0,
    id,
    req.user.id
  );

  if (existing.image_url && existing.image_url !== data.imageUrl) {
    removeUploadedImage(existing.image_url);
  }

  const product = db
    .prepare(`
      SELECT p.*, c.name AS category_name
      FROM products p JOIN categories c ON c.id = p.category_id
      WHERE p.id = ?
    `)
    .get(id);

  res.json({ product: mapProduct(product) });
});

router.delete('/products/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const existing = db
    .prepare('SELECT * FROM products WHERE id = ? AND seller_id = ?')
    .get(id, req.user.id);

  if (!existing) {
    return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  }

  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  removeUploadedImage(existing.image_url);
  res.json({ ok: true });
});

router.get('/categories', (req, res) => {
  const categories = db
    .prepare(`
      SELECT c.id, c.name, COUNT(p.id) AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.seller_id = ?
      GROUP BY c.id
      ORDER BY c.name COLLATE NOCASE ASC
    `)
    .all(req.user.id);
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
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
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

module.exports = router;
