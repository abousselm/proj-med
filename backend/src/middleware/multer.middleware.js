import multer from 'multer';
import path from 'path';
import { getUploadDir } from '../utils/upload.js';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getUploadDir());
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext || '';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${unique}${safeExt}`);
  },
});

export const uploadDoctorDocs = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB each

  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(new Error('Unsupported file type'), false);
  },
});

