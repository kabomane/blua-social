import { Router } from 'express'
import { db } from '../database/db.js'
import { materializeArrivedBroadcasts, resolveBroadcastAccess } from '../deliveries/broadcasts.js'

export const messagesRouter: Router = Router()

interface MessageRow {
  id: string
  author_id: string
  username: string
  avatar_updated_at: number | null
  content: string
  created_at: number
  parent_message_id: string | null
  recipient_user_id: string | null
  method: 'BIRD' | 'POST' | null
  distance_km: number | null
  delivered_at: number | null
  available_at: number | null
  recipient_type: 'HOME' | 'BRANCH' | 'USER' | null
  distribution_started_at: number | null
  transmission_count: number
}

const avatarUrl = (userId: string, updatedAt: number | null) =>
  updatedAt ? `/api/auth/avatar/${userId}?v=${updatedAt}` : null

function canRead(row: MessageRow, userId: string, now: number) {
  if (row.author_id === userId) return true
  if (row.recipient_type === 'USER') {
    return row.recipient_user_id === userId && (row.available_at ?? Number.MAX_SAFE_INTEGER) <= now
  }
  return resolveBroadcastAccess(row.id, userId, now)
}

function arrivedAt(row: MessageRow, userId: string) {
  if (row.author_id === userId) return row.created_at
  return row.available_at ?? row.distribution_started_at ?? row.delivered_at ?? row.created_at
}

const messageSelect = `
  SELECT message.id, message.author_id, user.username, user.avatar_updated_at,
         message.content, message.created_at, message.parent_message_id,
         message.recipient_user_id, message.available_at,
         delivery.method, delivery.distance_km, delivery.delivered_at,
         delivery.recipient_type, broadcast.distribution_started_at,
         (SELECT COUNT(*) FROM messages transmission WHERE transmission.source_message_id = message.id) AS transmission_count
  FROM messages message
  JOIN users user ON user.id = message.author_id
  LEFT JOIN deliveries delivery ON delivery.id = (
    SELECT selected.id FROM deliveries selected
    WHERE selected.message_id = message.id ORDER BY selected.sent_at DESC LIMIT 1
  )
  LEFT JOIN broadcasts broadcast ON broadcast.message_id = message.id`

function feedResponse(messages: MessageRow[], replies: MessageRow[], userId: string, now: number) {
  return messages.map((message) => ({
    id: message.id,
    authorId: message.author_id,
    author: message.username,
    handle: message.username,
    avatarUrl: avatarUrl(message.author_id, message.avatar_updated_at),
    text: message.content,
    method: message.method ?? 'POST',
    distanceKm: message.distance_km,
    arrivedAt: arrivedAt(message, userId) * 1000,
    pending: message.author_id === userId && message.delivered_at !== null && message.delivered_at > now,
    transmissions: message.transmission_count,
    replies: replies.filter((reply) => reply.parent_message_id === message.id).map((reply) => ({
      id: reply.id,
      author: reply.username,
      handle: reply.username,
      text: reply.content,
      arrivedAt: arrivedAt(reply, userId) * 1000,
      method: reply.method ?? 'POST',
      pending: reply.author_id === userId && reply.delivered_at !== null && reply.delivered_at > now,
    })),
  }))
}

messagesRouter.get('/feed', (req, res) => {
  const userId = String(req.query.userId ?? '')
  if (!userId) return res.status(400).json({ error: 'Utilisateur requis.' })
  if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId)) return res.status(404).json({ error: 'Compte introuvable.' })

  const now = Math.floor(Date.now() / 1000)
  materializeArrivedBroadcasts(now)
  const candidates = db.prepare(
    `${messageSelect}
     WHERE message.type = 'HOME'
       AND (
         message.author_id = ?
         OR EXISTS (
           SELECT 1 FROM follows follow
           WHERE follow.follower_id = ? AND follow.followed_id = message.author_id
             AND follow.status = 'ACCEPTED'
         )
         OR EXISTS (
           SELECT 1 FROM follow_periods period
           WHERE period.follower_id = ? AND period.followed_id = message.author_id
             AND period.started_at <= COALESCE(broadcast.distribution_started_at, ?)
             AND (period.ended_at IS NULL OR period.ended_at > COALESCE(broadcast.distribution_started_at, ?))
         )
       )
     ORDER BY message.created_at DESC LIMIT 300`,
  ).all(userId, userId, userId, now, now) as MessageRow[]
  const messages = candidates.filter((message) => canRead(message, userId, now)).slice(0, 100)
  const ids = messages.map((message) => message.id)
  const replyRows = ids.length
    ? db.prepare(
        `${messageSelect}
         WHERE message.type = 'REPLY'
           AND message.parent_message_id IN (${ids.map(() => '?').join(', ')})
         ORDER BY message.created_at ASC`,
      ).all(...ids) as MessageRow[]
    : []
  const replies = replyRows.filter((reply) => canRead(reply, userId, now))

  res.json({ messages: feedResponse(messages, replies, userId, now) })
})

messagesRouter.get('/branch', (req, res) => {
  const userId = String(req.query.userId ?? '')
  const branchId = String(req.query.branchId ?? '')
  if (!userId || !branchId) return res.status(400).json({ error: 'Utilisateur et branche requis.' })
  if (!db.prepare(
    `SELECT 1 FROM branch_memberships membership
     JOIN branches branch ON branch.id = membership.branch_id
     WHERE membership.user_id = ? AND membership.branch_id = ?
       AND branch.archived_at IS NULL`,
  ).get(userId, branchId)) return res.status(403).json({ error: 'Accès à cette branche refusé.' })

  const now = Math.floor(Date.now() / 1000)
  materializeArrivedBroadcasts(now)
  const candidates = db.prepare(
    `${messageSelect}
     WHERE message.type = 'BRANCH' AND message.branch_id = ?
     ORDER BY message.created_at DESC LIMIT 200`,
  ).all(branchId) as MessageRow[]
  const messages = candidates.filter((message) => canRead(message, userId, now)).slice(0, 100)
  const ids = messages.map((message) => message.id)
  const replyRows = ids.length
    ? db.prepare(
        `${messageSelect}
         WHERE message.type = 'REPLY'
           AND message.parent_message_id IN (${ids.map(() => '?').join(', ')})
         ORDER BY message.created_at ASC`,
      ).all(...ids) as MessageRow[]
    : []
  const replies = replyRows.filter((reply) => canRead(reply, userId, now))
  res.json({ messages: feedResponse(messages, replies, userId, now) })
})

messagesRouter.get('/pending', (req, res) => {
  const userId = String(req.query.userId ?? '')
  const requestedType = String(req.query.type ?? '')
  const allowedTypes = ['HOME', 'BRANCH', 'DIRECT', 'REPLY']
  if (!userId) return res.status(400).json({ error: 'Utilisateur requis.' })
  if (requestedType && !allowedTypes.includes(requestedType)) return res.status(400).json({ error: 'Type de message invalide.' })

  const now = Math.floor(Date.now() / 1000)
  const rows = db.prepare(
    `SELECT message.id, message.type, message.content, message.created_at,
            delivery.method, delivery.distance_km, delivery.delivered_at,
            delivery.recipient_type, branch.name AS branch_name,
            recipient.username AS recipient_name
     FROM messages message
     JOIN deliveries delivery ON delivery.id = (
       SELECT selected.id FROM deliveries selected
       WHERE selected.message_id = message.id ORDER BY selected.sent_at DESC LIMIT 1
     )
     LEFT JOIN branches branch ON branch.id = message.branch_id
     LEFT JOIN users recipient ON recipient.id = message.recipient_user_id
     WHERE message.author_id = ? AND delivery.delivered_at > ?
       AND (? = '' OR message.type = ?)
     ORDER BY message.created_at DESC`,
  ).all(userId, now, requestedType, requestedType) as {
    id: string
    type: string
    content: string
    created_at: number
    method: 'BIRD' | 'POST'
    distance_km: number | null
    delivered_at: number
    recipient_type: 'HOME' | 'BRANCH' | 'USER'
    branch_name: string | null
    recipient_name: string | null
  }[]
  res.json({
    messages: rows.map((row) => ({
      id: row.id, type: row.type, text: row.content, method: row.method,
      distanceKm: row.distance_km, createdAt: row.created_at * 1000,
      deliveredAt: row.delivered_at * 1000,
      destinationLabel: row.recipient_type === 'HOME'
        ? 'Home'
        : row.recipient_type === 'BRANCH' ? row.branch_name ?? 'Branche' : row.recipient_name ?? 'Cui-to-cui',
    })),
  })
})
