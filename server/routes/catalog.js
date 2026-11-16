'use strict';

const express = require('express');
const { db } = require('../db');
const { asString } = require('../validate');

const router = express.Router();

const SORTS = {
  featured: 'p.featured DESC, p.name COLLATE NOCASE ASC',
  name_asc: 'p.name COLLATE NOCASE ASC',
  price_asc: 'p.price ASC, p.name COLLATE NOCASE ASC',
  price_desc: 'p.price DESC, p.name COLLATE NOCASE ASC',
  stock_desc: 'p.stock DESC, p.name COLLATE NOCASE ASC',
};

function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    stock: row.stock,
    image_url: row.image_url,
    featured: Boolean(row.featured),
    category_id: row.category_id,
    category_name: row.category_name,
    seller_id: row.seller_id,
    seller_name: row.seller_name,
    whatsapp_number: row.whatsapp_number,
  };
}

function getPublicSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    store_name: settings.store_name || 'GeprekOn',
    whatsapp_number: settings.whatsapp_number || '',
    store_address: settings.store_address || '',
    store_open_hours: settings.store_open_hours || '',
  };
}

router.get('/store', (req, res) => {
  res.json({ store: getPublicSettings() });
});

router.get('/categories', (req, res) => {
  const categories = db
    .prepare(`
      SELECT c.id, c.name, COUNT(p.id) AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
        AND p.seller_id IN (SELECT id FROM users WHERE role = 'seller' AND is_active = 1)
      GROUP BY c.id
      ORDER BY c.name COLLATE NOCASE ASC
    `)
    .all();
  res.json({ categories });
});

router.get('/catalog', (req, res) => {
  const search = asString(req.query.search).slice(0, 100);
  const categoryId = Number.parseInt(req.query.category, 10);
  const sort = SORTS[asString(req.query.sort)] ? asString(req.query.sort) : 'featured';

  const conditions = [
    "u.role = 'seller'",
    'u.is_active = 1',
  ];
  const params = {};

  if (search) {
    conditions.push(
      '(p.name LIKE @search ESCAPE \'\\\' OR p.description LIKE @search ESCAPE \'\\\')'
    );
    const escaped = search.replace(/[\\%_]/g, (char) => `\\${char}`);
    params.search = `%${escaped}%`;
  }
  if (Number.isInteger(categoryId) && categoryId > 0) {
    conditions.push('p.category_id = @categoryId');
    params.categoryId = categoryId;
  }

  const rows = db
    .prepare(`
      SELECT p.*, c.name AS category_name, u.name AS seller_name
      FROM products p
      JOIN users u ON u.id = p.seller_id
      JOIN categories c ON c.id = p.category_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${SORTS[sort]}
    `)
    .all(params);

  const settings = getPublicSettings();
  const products = rows.map((row) =>
    mapProduct({ ...row, whatsapp_number: settings.whatsapp_number })
  );

  res.json({
    products,
    store: settings,
    total: products.length,
    sort,
    search,
  });
});

module.exports = { router, getPublicSettings, mapProduct };
