import express, { Router } from 'express'
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db } from '../database/db.js'

export const authRouter: Router = Router()
const PROFILE_BUCKET = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/profile-bucket')
const LOCATION_REFRESH_SECONDS = 24 * 60 * 60
const AVATAR_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const MAX_AVATAR_BYTES = 5 * 1024 * 1024

fs.mkdirSync(PROFILE_BUCKET, { recursive: true })

// Résolution du nom de ville (best effort, jamais bloquant) via Nominatim.
async function resolveCity(
  lat: number,
  lon: number,
): Promise<{ city: string | null; country_code: string | null }> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10` +
      `&lat=${lat}&lon=${lon}&accept-language=fr`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'blue-atmosphere-dev' },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return { city: null, country_code: null }
    const data = (await res.json()) as {
      address?: { city?: string; town?: string; village?: string; municipality?: string; country_code?: string }
    }
    const a = data.address ?? {}
    return {
      city: a.city ?? a.town ?? a.village ?? a.municipality ?? null,
      country_code: a.country_code?.toUpperCase() ?? null,
    }
  } catch {
    return { city: null, country_code: null }
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// @username : 3-20 caractères, lettres/chiffres/underscore
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const candidate = scryptSync(password, salt, 64)
  return timingSafeEqual(candidate, Buffer.from(hash, 'hex'))
}

interface UserRow {
  id: string
  email: string | null
  username: string
  city: string | null
  password_hash: string | null
  location_checked_at: number | null
  avatar_key: string | null
  avatar_updated_at: number | null
}

function publicUser(row: Pick<UserRow, 'id' | 'email' | 'username' | 'city' | 'location_checked_at' | 'avatar_updated_at'>) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    city: row.city,
    locationCheckedAt: row.location_checked_at,
    avatarUrl: row.avatar_updated_at ? `/api/auth/avatar/${row.id}?v=${row.avatar_updated_at}` : null,
  }
}

const emailTaken = (email: string) =>
  !!db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)
const usernameTaken = (username: string) =>
  !!db.prepare('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE').get(username)

// GET /api/auth/check-email?email=...
authRouter.get('/check-email', (req, res) => {
  const email = String(req.query.email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Email invalide.' })
  res.json({ available: !emailTaken(email) })
})

// GET /api/auth/check-username?username=...
authRouter.get('/check-username', (req, res) => {
  const username = String(req.query.username ?? '').trim()
  if (!USERNAME_RE.test(username)) {
    return res
      .status(400)
      .json({ error: '3 à 20 caractères : lettres, chiffres, underscore.' })
  }
  res.json({ available: !usernameTaken(username) })
})

// POST /api/auth/register — { email, password, username, latitude, longitude, timezone }
// La localisation est OBLIGATOIRE : le réseau est géographique.
authRouter.post('/register', async (req, res) => {
  const { email, password, username, latitude, longitude, timezone } = req.body ?? {}

  const mail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!EMAIL_RE.test(mail)) {
    return res.status(400).json({ error: 'Email invalide.' })
  }
  if (typeof password !== 'string' || password.length < 4) {
    return res.status(400).json({ error: 'Mot de passe : 4 caractères minimum.' })
  }
  const name = typeof username === 'string' ? username.trim() : ''
  if (!USERNAME_RE.test(name)) {
    return res
      .status(400)
      .json({ error: "Nom d'utilisateur : 3 à 20 caractères (lettres, chiffres, _)." })
  }
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return res
      .status(400)
      .json({ error: 'Localisation requise pour rejoindre le réseau.' })
  }
  if (emailTaken(mail)) {
    return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' })
  }
  if (usernameTaken(name)) {
    return res.status(409).json({ error: "Ce nom d'utilisateur est déjà pris." })
  }

  // Le navigateur fournit déjà une précision adaptée. Conserver cette position
  // pour des calculs de distance fidèles ; l'interface n'affiche que la ville.
  const lat = latitude
  const lon = longitude
  const { city, country_code } = await resolveCity(lat, lon)

  const user = {
    id: randomUUID(),
    email: mail,
    username: name,
    latitude: lat,
    longitude: lon,
    city,
    country_code,
    timezone: typeof timezone === 'string' && timezone ? timezone : null,
    password_hash: hashPassword(password),
    created_at: Math.floor(Date.now() / 1000),
  }
  const location_checked_at = user.created_at

  db.prepare(
    `INSERT INTO users (
       id, email, username, latitude, longitude, city, country_code, timezone,
       password_hash, location_checked_at, created_at
     ) VALUES (
       @id, @email, @username, @latitude, @longitude, @city, @country_code, @timezone,
       @password_hash, @location_checked_at, @created_at
     )`,
  ).run({ ...user, location_checked_at })

  res.status(201).json({ user: publicUser({ ...user, location_checked_at, avatar_updated_at: null }) })
})

// POST /api/auth/login — { email, password }
authRouter.post('/login', (req, res) => {
  const { email, password } = req.body ?? {}

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email et mot de passe requis.' })
  }

  const row = db
    .prepare(
      'SELECT id, email, username, city, password_hash, location_checked_at, avatar_key, avatar_updated_at FROM users WHERE email = ?',
    )
    .get(email.trim().toLowerCase()) as UserRow | undefined

  if (!row?.password_hash || !verifyPassword(password, row.password_hash)) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect.' })
  }

  res.json({ user: publicUser(row) })
})

// POST /api/auth/location — l'application appelle cette route au premier plan
// après 24 h. Latitude/longitude ne ressortent jamais dans la réponse.
authRouter.post('/location', async (req, res) => {
  const { userId, latitude, longitude, timezone } = req.body ?? {}
  if (typeof userId !== 'string' || !userId) return res.status(400).json({ error: 'Utilisateur requis.' })
  if (
    typeof latitude !== 'number' || typeof longitude !== 'number' ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
  ) return res.status(400).json({ error: 'Localisation valide requise.' })

  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId)
  if (!existing) return res.status(404).json({ error: 'Compte introuvable.' })

  const now = Math.floor(Date.now() / 1000)
  const { city, country_code } = await resolveCity(latitude, longitude)
  db.prepare(
    `UPDATE users SET latitude = ?, longitude = ?, city = ?, country_code = ?, timezone = ?, location_checked_at = ? WHERE id = ?`,
  ).run(latitude, longitude, city, country_code, typeof timezone === 'string' ? timezone : null, now, userId)

  const row = db.prepare(
    'SELECT id, email, username, city, location_checked_at, avatar_updated_at FROM users WHERE id = ?',
  ).get(userId) as UserRow
  res.json({ user: publicUser(row), refreshAfter: now + LOCATION_REFRESH_SECONDS })
})

authRouter.put('/avatar', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_AVATAR_BYTES }), (req, res) => {
  const userId = req.header('x-user-id')
  const extension = AVATAR_TYPES[req.header('content-type')?.split(';')[0] ?? '']
  if (!userId) return res.status(400).json({ error: 'Utilisateur requis.' })
  if (!extension || !Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'Photo JPEG, PNG ou WebP requise.' })
  }
  if (req.body.length > MAX_AVATAR_BYTES) return res.status(413).json({ error: 'Photo limitée à 5 Mo.' })

  const existing = db.prepare('SELECT avatar_key FROM users WHERE id = ?').get(userId) as Pick<UserRow, 'avatar_key'> | undefined
  if (!existing) return res.status(404).json({ error: 'Compte introuvable.' })

  const key = `${randomUUID()}.${extension}`
  fs.writeFileSync(path.join(PROFILE_BUCKET, key), req.body, { flag: 'wx' })
  const now = Math.floor(Date.now() / 1000)
  db.prepare('UPDATE users SET avatar_key = ?, avatar_updated_at = ? WHERE id = ?').run(key, now, userId)
  if (existing.avatar_key) fs.rm(path.join(PROFILE_BUCKET, existing.avatar_key), { force: true }, () => {})

  const row = db.prepare(
    'SELECT id, email, username, city, location_checked_at, avatar_updated_at FROM users WHERE id = ?',
  ).get(userId) as UserRow
  res.json({ user: publicUser(row) })
})

authRouter.get('/avatar/:userId', (req, res) => {
  const row = db.prepare('SELECT avatar_key FROM users WHERE id = ?').get(req.params.userId) as Pick<UserRow, 'avatar_key'> | undefined
  if (!row?.avatar_key || !/^[a-f0-9-]+\.(jpg|png|webp)$/.test(row.avatar_key)) return res.sendStatus(404)
  const file = path.join(PROFILE_BUCKET, row.avatar_key)
  if (!fs.existsSync(file)) return res.sendStatus(404)
  res.set('Cache-Control', 'public, max-age=31536000, immutable')
  res.sendFile(file)
})
