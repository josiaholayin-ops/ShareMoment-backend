import express from 'express';
import path from 'path';
import { getDb } from '../lib/db.js';
import { authRequired, requireRole } from '../middleware/auth.js';

const router = express.Router();
const db = getDb();

// Upload (creator only)
router.post('/', authRequired, requireRole('creator'), async (req, res) => {
  try {
    if (!req.files || !req.files.video) return res.status(400).json({ success:false, message:'Missing video file' });
    const { title, publisher = '', producer = '', genre = '', ageRating = '' } = req.body;
    if (!title) return res.status(400).json({ success:false, message:'Missing title' });

    const uploadDir = req._uploadDir;
    const file = req.files.video;
    const namePart = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.name) || '.mp4';
    const filename = namePart + ext;
    const destPath = path.join(uploadDir, filename);

    await new Promise((resolve, reject) => file.mv(destPath, (err) => err ? reject(err) : resolve()));
    const webPath = '/uploads/videos/' + filename;

    const info = db.prepare(`
      INSERT INTO videos (title, publisher, producer, genre, age_rating, filepath, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(title, publisher, producer, genre, ageRating, webPath, req.user.id);
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(info.lastInsertRowid);
    res.json({ success:true, video });
  } catch (e) {
    console.error('Upload error:', e);
    res.status(500).json({ success:false, message:'Upload failed' });
  }
});

// Feed/search
router.get('/', (req, res) => {
  const { page = 1, pageSize = 10, search = '' } = req.query;
  const p = Math.max(parseInt(page), 1);
  const ps = Math.min(Math.max(parseInt(pageSize), 1), 50);
  const offset = (p - 1) * ps;
  const where = search ? `WHERE v.title LIKE ? OR v.genre LIKE ?` : '';
  const stmt = db.prepare(`
    SELECT v.*, u.display_name as creator_name,
      (SELECT COUNT(*) FROM likes l WHERE l.video_id = v.id) as like_count,
      (SELECT IFNULL(ROUND(AVG(stars),1),0) FROM ratings r WHERE r.video_id = v.id) as avg_rating,
      (SELECT COUNT(*) FROM comments c WHERE c.video_id = v.id) as comment_count
    FROM videos v
    JOIN users u ON u.id = v.user_id
    ${where}
    ORDER BY datetime(v.created_at) DESC
    LIMIT ? OFFSET ?
  `);
  let items;
  if (search) {
    const s = `%${search}%`;
    items = stmt.all(s, s, ps, offset);
  } else {
    items = stmt.all(ps, offset);
  }
  res.json({ success:true, items });
});

// Single video with comments
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const v = db.prepare(`
    SELECT v.*, u.display_name as creator_name,
      (SELECT COUNT(*) FROM likes l WHERE l.video_id = v.id) as like_count,
      (SELECT IFNULL(ROUND(AVG(stars),1),0) FROM ratings r WHERE r.video_id = v.id) as avg_rating
    FROM videos v
    JOIN users u ON u.id = v.user_id
    WHERE v.id = ?
  `).get(id);
  if (!v) return res.status(404).json({ success:false, message:'Video not found' });
  const comments = db.prepare(`
    SELECT c.*, u.display_name as user_name
    FROM comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.video_id = ?
    ORDER BY datetime(c.created_at) DESC
  `).all(id);
  res.json({ success:true, video: v, comments });
});

// Like / Unlike
router.post('/:id/like', authRequired, (req, res) => {
  const id = parseInt(req.params.id);
  try { db.prepare('INSERT INTO likes (user_id, video_id) VALUES (?, ?)').run(req.user.id, id); } catch {}
  const c = db.prepare('SELECT COUNT(*) as c FROM likes WHERE video_id = ?').get(id).c;
  res.json({ success:true, likeCount: c });
});

router.delete('/:id/like', authRequired, (req, res) => {
  const id = parseInt(req.params.id);
  db.prepare('DELETE FROM likes WHERE user_id = ? AND video_id = ?').run(req.user.id, id);
  const c = db.prepare('SELECT COUNT(*) as c FROM likes WHERE video_id = ?').get(id).c;
  res.json({ success:true, likeCount: c });
});

// Comment
router.post('/:id/comment', authRequired, (req, res) => {
  const id = parseInt(req.params.id);
  const { text } = req.body;
  if (!text) return res.status(400).json({ success:false, message:'Missing text' });
  const info = db.prepare('INSERT INTO comments (user_id, video_id, text) VALUES (?, ?, ?)').run(req.user.id, id, text);
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(info.lastInsertRowid);
  res.json({ success:true, comment });
});

// Rate
router.post('/:id/rate', authRequired, (req, res) => {
  const id = parseInt(req.params.id);
  let { stars } = req.body;
  stars = parseInt(stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return res.status(400).json({ success:false, message:'Stars 1-5' });
  const existing = db.prepare('SELECT id FROM ratings WHERE user_id = ? AND video_id = ?').get(req.user.id, id);
  if (existing) {
    db.prepare('UPDATE ratings SET stars = ?, created_at = datetime("now") WHERE id = ?').run(stars, existing.id);
  } else {
    db.prepare('INSERT INTO ratings (user_id, video_id, stars) VALUES (?, ?, ?)').run(req.user.id, id, stars);
  }
  const avg = db.prepare('SELECT IFNULL(ROUND(AVG(stars),1),0) as avg FROM ratings WHERE video_id = ?').get(id).avg;
  res.json({ success:true, avgRating: avg });
});

export default router;
