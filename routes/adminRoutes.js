import express from 'express';
import { getDb } from '../lib/db.js';
import { seedDefaults } from '../lib/seed.js';

const router = express.Router();
const db = getDb();

router.post('/promote-creator', (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== (process.env.CREATOR_PROMO_SECRET || 'promote-creator-secret')) {
    return res.status(403).json({ success:false, message:'Forbidden' });
  }
  const { email } = req.body;
  if (!email) return res.status(400).json({ success:false, message:'Missing email' });
  const lower = String(email).toLowerCase().trim();
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(lower);
  if (!u) return res.status(404).json({ success:false, message:'User not found' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run('creator', u.id);
  res.json({ success:true, message:'User promoted to creator' });
});

router.post('/seed-defaults', async (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== (process.env.CREATOR_PROMO_SECRET || 'promote-creator-secret')) {
    return res.status(403).json({ success:false, message:'Forbidden' });
  }
  const uploadDir = req._uploadDir;
  await seedDefaults(uploadDir);
  res.json({ success:true, message:'Seeding attempted; check server logs.' });
});

export default router;
