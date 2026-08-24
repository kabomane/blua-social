import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { db } from '../database/db.js'
import { distanceKm } from '../delivery-engine/haversine.js'

export const branchesRouter: Router = Router()

type Visibility = 'PUBLIC' | 'PRIVATE'

interface BranchRow {
  id: string
  name: string
  visibility: Visibility
  latitude: number
  longitude: number
  created_at: number
  role: 'OWNER' | 'MODERATOR' | 'MEMBER' | null
  member_count: number
}

function serializeBranch(row: BranchRow, user: { latitude: number; longitude: number }) {
  return {
    id: row.id,
    name: row.name,
    visibility: row.visibility,
    role: row.role,
    memberCount: row.member_count,
    distanceKm: distanceKm(
      { lat: user.latitude, lon: user.longitude },
      { lat: row.latitude, lon: row.longitude },
    ),
    createdAt: row.created_at * 1000,
  }
}

branchesRouter.get('/', (req, res) => {
  const userId = String(req.query.userId ?? '')
  const view = String(req.query.view ?? 'mine')
  if (!userId) return res.status(400).json({ error: 'Utilisateur requis.' })
  if (!['mine', 'discover'].includes(view)) return res.status(400).json({ error: 'Vue invalide.' })

  const user = db.prepare(
    'SELECT latitude, longitude FROM users WHERE id = ?',
  ).get(userId) as { latitude: number; longitude: number } | undefined
  if (!user) return res.status(404).json({ error: 'Compte introuvable.' })

  const membershipJoin = `
    LEFT JOIN branch_memberships membership
      ON membership.branch_id = branch.id AND membership.user_id = ?`
  const rows = db.prepare(
    `SELECT branch.id, branch.name, branch.visibility, branch.latitude,
            branch.longitude, branch.created_at, membership.role,
            (SELECT COUNT(*) FROM branch_memberships member
             WHERE member.branch_id = branch.id) AS member_count
     FROM branches branch
     ${membershipJoin}
     WHERE branch.archived_at IS NULL
       AND ${view === 'mine'
         ? 'membership.user_id IS NOT NULL'
         : "branch.visibility = 'PUBLIC' AND membership.user_id IS NULL"}
     ORDER BY branch.created_at DESC, branch.name COLLATE NOCASE ASC`,
  ).all(userId) as BranchRow[]

  res.json({ branches: rows.map((row) => serializeBranch(row, user)) })
})

branchesRouter.post('/', (req, res) => {
  const userId = String(req.body?.userId ?? '')
  const name = String(req.body?.name ?? '').trim().replace(/\s+/g, ' ')
  const visibility = String(req.body?.visibility ?? 'PUBLIC') as Visibility
  const latitude = Number(req.body?.latitude)
  const longitude = Number(req.body?.longitude)
  if (!userId) return res.status(400).json({ error: 'Utilisateur requis.' })
  if (name.length < 2 || name.length > 60) return res.status(400).json({ error: 'Le nom doit contenir entre 2 et 60 caractères.' })
  if (!['PUBLIC', 'PRIVATE'].includes(visibility)) return res.status(400).json({ error: 'Visibilité invalide.' })
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: 'Une position GPS actuelle est obligatoire.' })
  }

  const user = db.prepare(
    'SELECT latitude, longitude FROM users WHERE id = ?',
  ).get(userId) as { latitude: number; longitude: number } | undefined
  if (!user) return res.status(404).json({ error: 'Compte introuvable.' })

  const id = randomUUID()
  const now = Math.floor(Date.now() / 1000)
  db.transaction(() => {
    db.prepare(
      `INSERT INTO branches (
         id, name, owner_id, latitude, longitude, visibility, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, name, userId, latitude, longitude, visibility, now)
    db.prepare(
      `INSERT INTO branch_memberships (branch_id, user_id, role, joined_at)
       VALUES (?, ?, 'OWNER', ?)`,
    ).run(id, userId, now)
    db.prepare(
      `INSERT INTO branch_membership_periods (
         id, branch_id, user_id, slot_index, role, joined_at
       ) VALUES (?, ?, ?, 0, 'OWNER', ?)`,
    ).run(randomUUID(), id, userId, now)
  })()

  const row = db.prepare(
    `SELECT branch.id, branch.name, branch.visibility, branch.latitude,
            branch.longitude, branch.created_at, membership.role,
            1 AS member_count
     FROM branches branch
     JOIN branch_memberships membership
       ON membership.branch_id = branch.id AND membership.user_id = ?
     WHERE branch.id = ?`,
  ).get(userId, id) as BranchRow
  res.status(201).json({ branch: serializeBranch(row, { latitude, longitude }) })
})
