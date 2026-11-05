const multer = require('multer');
const env = require('../config/env');
const { AppError } = require('../utils/AppError');
const { ALLOWED_IMAGE_TYPES } = require('../utils/imageSignature');

const maxMb = Math.round(env.limits.maxImageBytes / (1024 * 1024));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.limits.maxImageBytes,
    files: 1,
    fields: 12,
    fieldSize: 8 * 1024,
    parts: 16
  },
  fileFilter(req, file, callback) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return callback(
        new AppError(415, 'UNSUPPORTED_IMAGE_TYPE', 'Format gambar tidak didukung. Gunakan JPG, PNG, atau WEBP.')
      );
    }
    return callback(null, true);
  }
});

function mapUploadError(error) {
  if (error instanceof AppError) return error;

  if (error && error.name === 'MulterError') {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return new AppError(413, 'IMAGE_TOO_LARGE', `Ukuran gambar melebihi batas ${maxMb} MB.`);
      case 'LIMIT_UNEXPECTED_FILE':
      case 'LIMIT_FILE_COUNT':
        return new AppError(400, 'INVALID_UPLOAD', 'Kirim tepat satu gambar pada field bernama "image".');
      default:
        return new AppError(400, 'INVALID_UPLOAD', 'Data upload tidak valid atau terlalu besar.');
    }
  }

  return new AppError(400, 'INVALID_UPLOAD', 'Data upload tidak bisa dibaca. Pastikan dikirim sebagai multipart/form-data.');
}

function uploadSingleImage(req, res, next) {
  upload.single('image')(req, res, (error) => {
    if (error) return next(mapUploadError(error));
    return next();
  });
}

module.exports = { uploadSingleImage, mapUploadError };
