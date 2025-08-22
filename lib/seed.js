import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { getDb } from './db.js';

function ensureUser(db, { email, display_name, role, password }) {
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return existing;
  const password_hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?)')
    .run(email.toLowerCase(), password_hash, display_name, role);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
}

function titleFromFilename(filename) {
  return filename.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function seedDefaults(uploadDir) {
  const db = getDb();
  if (!fs.existsSync(uploadDir)) return;

  const creator = ensureUser(db, { email: 'creator@sharemoment.local', display_name: 'Demo Creator', role: 'creator', password: 'SeedPass!234' });
  const alice = ensureUser(db, { email: 'alice@sharemoment.local', display_name: 'Alice', role: 'consumer', password: 'SeedPass!234' });
  const bob = ensureUser(db, { email: 'bob@sharemoment.local', display_name: 'Bob', role: 'consumer', password: 'SeedPass!234' });

  const allowed = new Set(['.mp4', '.webm', '.ogg']);
  let inserted = 0;
  for (const f of fs.readdirSync(uploadDir)) {
    const ext = path.extname(f).toLowerCase();
    if (!allowed.has(ext)) continue;
    const webPath = '/uploads/videos/' + f;
    const exists = db.prepare('SELECT id FROM videos WHERE filepath = ?').get(webPath);
    if (exists) continue;

    const info = db.prepare(`
      INSERT INTO videos (title, publisher, producer, genre, age_rating, filepath, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      titleFromFilename(f),
      'ShareMoment Demos',
      'Seed Bot',
      'Demo',
      'PG',
      webPath,
      creator.id
    );
    const id = info.lastInsertRowid;
    try { db.prepare('INSERT INTO likes (user_id, video_id) VALUES (?, ?)').run(alice.id, id); } catch {}
    try { db.prepare('INSERT INTO likes (user_id, video_id) VALUES (?, ?)').run(bob.id, id); } catch {}
    db.prepare('INSERT INTO ratings (user_id, video_id, stars) VALUES (?, ?, ?)').run(alice.id, id, 5);
    db.prepare('INSERT INTO ratings (user_id, video_id, stars) VALUES (?, ?, ?)').run(bob.id, id, 4);
    db.prepare('INSERT INTO comments (user_id, video_id, text) VALUES (?, ?, ?)').run(alice.id, id, 'Love this demo!');
    db.prepare('INSERT INTO comments (user_id, video_id, text) VALUES (?, ?, ?)').run(bob.id, id, 'Smooth playback \uD83D\uDC4D');
    inserted++;
  }
  console.log(inserted > 0 ? `Seed: inserted ${inserted} video(s).` : 'Seed: no new videos found (drop .mp4 files into uploads/videos).');
}
