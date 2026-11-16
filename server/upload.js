'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = EXTENSIONS[file.mimetype] || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!EXTENSIONS[file.mimetype]) {
      return cb(new Error('INVALID_IMAGE_TYPE'));
    }
    cb(null, true);
  },
});

function removeUploadedImage(imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('/uploads/')) return;
  const filename = path.basename(imageUrl);
  if (!filename) return;
  const filePath = path.join(UPLOAD_DIR, filename);
  fs.promises.unlink(filePath).catch(() => {});
}

module.exports = { upload, removeUploadedImage, UPLOAD_DIR };
