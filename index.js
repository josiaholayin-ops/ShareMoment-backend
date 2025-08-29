// index.js  — ShareMoment backend (Windows Azure–ready)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import fileUpload from 'express-fileupload';
import { fileURLToPath } from 'url';

import authRoutes from './routes/authRoutes.js';
import videoRoutes from './routes/videoRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { initDb } from './lib/db.js';
import { seedDefaults } from './lib/seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

/**
 * Writable upload directory
 * - On Azure Windows: set UPLOAD_DIR = D:\home\uploads\videos (App Settings)
 * - Local fallback:  <repo>/uploads/videos
 */
const uploadDir =
  (process.env.UPLOAD_DIR && process.env.UPLOAD_DIR.trim()) ||
  path.join(process.cwd(), 'uploads', 'videos');

// Ensure upload dir exists
fs.mkdirSync(uploadDir, { recursive: true });

// ---- DB init & optional seeding (DB path handled inside lib/db.js via process.env.DB_FILE) ----
await initDb();
try {
  await seedDefaults(uploadDir);
} catch (err) {
  console.warn('Seed note:', err?.message || err);
}

// ---- Middleware ----
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const allowedOrigin = process.env.ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: allowedOrigin, credentials: true }));

app.use(morgan('dev'));
app.use(
  fileUpload({
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    createParentPath: true,
  })
);

// Serve uploaded videos from the writable path
app.use('/uploads/videos', express.static(uploadDir));

// Health check
app.get('/', (_req, res) => {
  res.json({ message: 'ShareMoment backend ok' });
});

// Inject uploadDir for routes that need it (uploads)
app.use((req, _res, next) => {
  req._uploadDir = uploadDir;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/admin', adminRoutes);

// Unified error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Start server on Azure's assigned port
app.listen(PORT, () => {
  if (!process.env.JWT_SECRET) {
    console.warn(
      'WARNING: JWT_SECRET not set; using insecure dev fallback. Set it in App Service → Configuration.'
    );
  }
  console.log(`API running on port ${PORT}`);
});
