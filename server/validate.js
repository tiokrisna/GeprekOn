'use strict';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const IMAGE_URL_RE = /^\/(uploads|img\/products)\/[A-Za-z0-9._-]+$/;
const ROLES = ['admin', 'seller', 'buyer'];

function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function asInteger(value) {
  let parsed = NaN;
  if (typeof value === 'number') {
    parsed = value;
  } else if (typeof value === 'string' && value.trim() !== '') {
    parsed = Number(value);
  }
  return Number.isInteger(parsed) ? parsed : NaN;
}

function validateUserInput(body, { requirePassword = true } = {}) {
  const errors = [];
  const name = asString(body.name);
  const email = asString(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const role = asString(body.role) || 'buyer';
  const isActive =
    body.is_active === undefined ? true : Boolean(body.is_active);

  if (name.length < 2 || name.length > 80) {
    errors.push('Nama harus 2-80 karakter.');
  }
  if (!EMAIL_RE.test(email) || email.length > 160) {
    errors.push('Format email tidak valid.');
  }
  if (requirePassword && password.length < 8) {
    errors.push('Password minimal 8 karakter.');
  }
  if (password.length > 200) {
    errors.push('Password terlalu panjang.');
  }
  if (!ROLES.includes(role)) {
    errors.push('Peran pengguna tidak valid.');
  }

  return {
    errors,
    data: { name, email, password, role, isActive },
  };
}

function validateProductInput(body) {
  const errors = [];
  const name = asString(body.name);
  const description = asString(body.description);
  const price = asInteger(body.price);
  const stock = asInteger(body.stock);
  const categoryId = asInteger(body.category_id);
  const imageUrl = asString(body.image_url);
  const featured = body.featured === true || body.featured === 1 || body.featured === '1';

  if (name.length < 1 || name.length > 100) {
    errors.push('Nama produk wajib diisi (maksimal 100 karakter).');
  }
  if (description.length > 500) {
    errors.push('Deskripsi maksimal 500 karakter.');
  }
  if (!Number.isInteger(price) || price < 0 || price > 1_000_000_000) {
    errors.push('Harga harus angka bulat 0 atau lebih.');
  }
  if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000_000) {
    errors.push('Stok harus bilangan bulat 0 atau lebih.');
  }
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    errors.push('Kategori wajib dipilih.');
  }
  if (imageUrl && !IMAGE_URL_RE.test(imageUrl)) {
    errors.push('Gambar produk tidak valid.');
  }

  return {
    errors,
    data: { name, description, price, stock, categoryId, imageUrl, featured },
  };
}

function validateCategoryName(value) {
  const name = asString(value).replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 50) {
    return { error: 'Nama kategori harus 2-50 karakter.' };
  }
  return { name };
}

function normalizeWhatsapp(value) {
  const digits = asString(value).replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) {
    return { error: 'Nomor WhatsApp harus 8-15 digit (contoh: 6281234567890).' };
  }
  return { digits };
}

module.exports = {
  ROLES,
  asString,
  validateUserInput,
  validateProductInput,
  validateCategoryName,
  normalizeWhatsapp,
};
