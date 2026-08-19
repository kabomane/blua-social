import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

// Une seule base pour le MVP : tout ce qui doit être atomique
// (messages, deliveries, pigeon_actions) reste dans le même fichier.
const DATA_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data',
)
export const DB_PATH = path.join(DATA_DIR, 'app.db')

fs.mkdirSync(DATA_DIR, { recursive: true })

export const db: Database.Database = new Database(DB_PATH)

// PRAGMA imposés par docs/b-atmos sqlite.txt
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.pragma('busy_timeout = 5000')
