import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_FILE = process.env.DB_FILE || path.join(process.cwd(), 'data', 'sharemoment.db');
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

let db;
export function getDb() {
  if (!db) {
    db = new Database(DB_FILE);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}
