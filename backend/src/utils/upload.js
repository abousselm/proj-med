import path from 'path';
import fs from 'fs';

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function getUploadDir() {
  const dir = path.join(process.cwd(), 'uploads', 'doctors');
  ensureDirSync(dir);
  return dir;
}

export function toPublicUrl(filePath) {
  // filePath is an absolute path like .../uploads/doctors/xyz
  // We expose static files under /uploads
  const uploadsRoot = path.join(process.cwd(), 'uploads');
  const rel = filePath.startsWith(uploadsRoot)
    ? filePath.slice(uploadsRoot.length)
    : filePath;
  const normalized = rel.split(path.sep).join('/');
  return `/uploads${normalized.startsWith('/') ? '' : '/'}${normalized.replace(/^\/+/, '')}`;
}

