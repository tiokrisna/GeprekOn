'use strict';

const { db } = require('./db');
const { hashPassword } = require('./auth');

const DEFAULT_SETTINGS = {
  store_name: 'GeprekOn',
  whatsapp_number: '6281234567890',
  store_address: 'Jl. Raya Pedas No. 17, Bandung',
  store_open_hours: 'Setiap hari, 10.00 - 21.00 WIB',
};

const SEED_USERS = [
  {
    name: 'Admin GeprekOn',
    email: 'admin@geprekon.id',
    password: 'Admin#123',
    role: 'admin',
  },
  {
    name: 'Dapur GeprekOn',
    email: 'seller@geprekon.id',
    password: 'Seller#123',
    role: 'seller',
  },
  {
    name: 'Pembeli Demo',
    email: 'pembeli@geprekon.id',
    password: 'Pembeli#123',
    role: 'buyer',
  },
];

const SEED_CATEGORIES = ['Ayam Geprek', 'Paket Hemat', 'Minuman', 'Camilan'];

const SEED_PRODUCTS = [
  {
    name: 'Ayam Geprek Original',
    category: 'Ayam Geprek',
    price: 15000,
    stock: 40,
    description: 'Ayam crispy digeprek dengan sambal bawang pedas khas GeprekOn.',
    image: '/img/products/geprek-original.svg',
    featured: true,
  },
  {
    name: 'Ayam Geprek Mozzarella',
    category: 'Ayam Geprek',
    price: 25000,
    stock: 24,
    description: 'Geprek favorit dengan lapisan keju mozzarella yang meleleh.',
    image: '/img/products/geprek-mozzarella.svg',
    featured: true,
  },
  {
    name: 'Paket Hemat Geprek + Es Teh',
    category: 'Paket Hemat',
    price: 20000,
    stock: 35,
    description: 'Satu porsi ayam geprek, nasi hangat, dan es teh manis. Paling worth it.',
    image: '/img/products/paket-hemat.svg',
    featured: true,
  },
  {
    name: 'Geprek Sambal Matah',
    category: 'Ayam Geprek',
    price: 18000,
    stock: 20,
    description: 'Ayam crispy dengan sambal matah segar khas Bali.',
    image: '/img/products/sambal-matah.svg',
    featured: false,
  },
  {
    name: 'Es Teh Manis',
    category: 'Minuman',
    price: 5000,
    stock: 100,
    description: 'Teh melati seduh segar dengan gula asli, disajikan dingin.',
    image: '/img/products/es-teh.svg',
    featured: false,
  },
  {
    name: 'Es Jeruk Peras',
    category: 'Minuman',
    price: 8000,
    stock: 60,
    description: 'Jeruk peras asli tanpa sirup buatan, segar dan sedikit asam.',
    image: '/img/products/es-jeruk.svg',
    featured: false,
  },
  {
    name: 'Tahu Crispy Sambal',
    category: 'Camilan',
    price: 10000,
    stock: 50,
    description: 'Tahu goreng crispy dengan taburan sambal bubuk pedas.',
    image: '/img/products/tahu-crispy.svg',
    featured: false,
  },
  {
    name: 'Kentang Goreng',
    category: 'Camilan',
    price: 12000,
    stock: 45,
    description: 'Kentang potong shoestring, gurih dan renyah. Cocok untuk camilan.',
    image: '/img/products/kentang.svg',
    featured: false,
  },
];

async function seed({ force = false } = {}) {
  const userCount = db.prepare('SELECT COUNT(*) AS total FROM users').get().total;

  if (force) {
    db.transaction(() => {
      db.prepare('DELETE FROM sessions').run();
      db.prepare('DELETE FROM products').run();
      db.prepare('DELETE FROM categories').run();
      db.prepare('DELETE FROM users').run();
      db.prepare('DELETE FROM settings').run();
    })();
  } else if (userCount > 0) {
    return false;
  }

  const hashed = {};
  for (const user of SEED_USERS) {
    hashed[user.email] = await hashPassword(user.password);
  }

  const insertUser = db.prepare(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
  );
  const insertCategory = db.prepare(
    'INSERT INTO categories (name, created_by) VALUES (?, ?)'
  );
  const insertProduct = db.prepare(`
    INSERT INTO products
      (seller_id, category_id, name, description, price, stock, image_url, featured)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSetting = db.prepare(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
  );

  db.transaction(() => {
    const userIds = {};
    for (const user of SEED_USERS) {
      const info = insertUser.run(
        user.name,
        user.email,
        hashed[user.email],
        user.role
      );
      userIds[user.email] = Number(info.lastInsertRowid);
    }

    const categoryIds = {};
    for (const name of SEED_CATEGORIES) {
      const info = insertCategory.run(name, userIds['admin@geprekon.id']);
      categoryIds[name] = Number(info.lastInsertRowid);
    }

    const sellerId = userIds['seller@geprekon.id'];
    for (const product of SEED_PRODUCTS) {
      insertProduct.run(
        sellerId,
        categoryIds[product.category],
        product.name,
        product.description,
        product.price,
        product.stock,
        product.image,
        product.featured ? 1 : 0
      );
    }

    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      insertSetting.run(key, value);
    }
  })();

  return true;
}

async function ensureSeed() {
  const count = db.prepare('SELECT COUNT(*) AS total FROM users').get().total;
  if (count === 0) {
    await seed();
  }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(
      key,
      value
    );
  }
}

if (require.main === module) {
  const force = process.argv.includes('--force');
  seed({ force })
    .then((created) => {
      console.log(
        created
          ? 'Database di-seed dengan akun, kategori, dan 8 produk contoh.'
          : 'Database sudah berisi data; gunakan --force untuk menimpa.'
      );
      console.log('Akun demo:');
      for (const user of SEED_USERS) {
        console.log(`- ${user.role}: ${user.email} / ${user.password}`);
      }
    })
    .catch((error) => {
      console.error('Gagal seed:', error);
      process.exitCode = 1;
    });
}

module.exports = { seed, ensureSeed, DEFAULT_SETTINGS };
