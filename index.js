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

// Ensure data dir and upload dir
const defaultUpload = path.join(__dirname, 'uploads', 'videos');
const uploadDir = process.env.UPLOAD_DIR && process.env.UPLOAD_DIR.trim() ? process.env.UPLOAD_DIR : defaultUpload;
if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// DB init & seed
initDb();
await seedDefaults(uploadDir);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: process.env.ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(morgan('dev'));
app.use(fileUpload({ limits: { fileSize: 100 * 1024 * 1024 }, createParentPath: true }));

// Static videos
app.use('/uploads/videos', express.static(uploadDir));

app.get('/', (_req, res) => res.json({ message: 'ShareMoment backend ok' }));

// Routes (inject uploadDir)
app.use((req, _res, next) => { req._uploadDir = uploadDir; next(); });
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

app.listen(PORT, () => {
  if (!process.env.JWT_SECRET) console.warn('WARNING: JWT_SECRET not set; using insecure dev fallback. Set JWT_SECRET in backend/.env');
  console.log(`API running on ${PORT}`);
});
