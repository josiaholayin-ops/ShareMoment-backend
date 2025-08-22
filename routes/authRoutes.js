import express from 'express';
import { getDb } from '../lib/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = express.Router();
const db = getDb();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_insecure_jwt_key_change_me';

router.post('/register', (req, res) => {
  const { email, password, displayName, asCreator, creatorCode } = req.body;
  if (!email || !password || !displayName) {
    return res.status(400).json({ success:false, message:'Missing fields' });
  }
  const lower = String(email).toLowerCase().trim();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(lower);
  if (existing) return res.status(409).json({ success:false, message:'Email already registered' });

  // decide role
  const code = process.env.CREATOR_SIGNUP_CODE || 'CREATOR2025';
  const role = (asCreator && creatorCode === code) ? 'creator' : 'consumer';

  const password_hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?)')
    .run(lower, password_hash, displayName, role);
  const user = db.prepare('SELECT id, email, display_name, role FROM users WHERE id = ?').get(info.lastInsertRowid);

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, displayName: user.display_name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ success:true, user, token });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success:false, message:'Missing fields' });
  const lower = String(email).toLowerCase().trim();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(lower);
  if (!user) return res.status(401).json({ success:false, message:'Invalid credentials' });
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ success:false, message:'Invalid credentials' });

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, displayName: user.display_name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ success:true, user: { id:user.id, email:user.email, display_name:user.display_name, role:user.role }, token });
});

export default router;
