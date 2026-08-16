import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { db, DB_PATH } from './db.js'

// Runner de migrations minimal : applique dans l'ordre les fichiers .sql
// de ./migrations qui n'ont pas encore été appliqués.

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'migrations',
)

db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  );
`)

const applied = new Set(
  db
    .prepare('SELECT name FROM _migrations')
    .all()
    .map((row) => (row as { name: string }).name),
)

const files = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()

for (const file of files) {
  if (applied.has(file)) continue

  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')

  const run = db.transaction(() => {
    db.exec(sql)
    db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(
      file,
      Math.floor(Date.now() / 1000),
    )
  })
  run()

  console.log(`applied  ${file}`)
}

console.log(`db ready ${DB_PATH}`)
