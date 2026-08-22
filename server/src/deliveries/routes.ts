import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { db } from '../database/db.js'
import { calculateBirdDelivery } from '../delivery-engine/bird.js'
import { distanceKm, type GeoPoint } from '../delivery-engine/haversine.js'
import { HUBS } from '../delivery-engine/hubs.js'
import { calculatePostDelivery, findNearestHub } from '../delivery-engine/post.js'
import { materializeArrivedBroadcasts } from './broadcasts.js'

export const deliveriesRouter: Router = Router()

const CAPACITY_PER_METHOD = 5
type Method = 'BIRD' | 'POST'
type MessageType = 'HOME' | 'BRANCH' | 'DIRECT' | 'REPLY'
type RecipientType = 'HOME' | 'BRANCH' | 'USER'

interface Target extends GeoPoint {
  id: string
}

interface Context {
  recipientType: RecipientType
  target: Target
  branchId: string | null
  recipientUserId: string | null
}

function capacity(userId: string) {
  const now = Math.floor(Date.now() / 1000)
  const rows = db.prepare(
    `SELECT action_type, COUNT(*) AS count FROM pigeon_actions
     WHERE user_id = ? AND busy_until > ? GROUP BY action_type`,
  ).all(userId, now) as { action_type: Method; count: number }[]
  const busy = (method: Method) => rows.find((row) => row.action_type === method)?.count ?? 0
  const birdBusy = busy('BIRD')
  const postBusy = busy('POST')
  return {
    bird: { total: CAPACITY_PER_METHOD, busy: birdBusy, available: CAPACITY_PER_METHOD - birdBusy },
    post: { total: CAPACITY_PER_METHOD, busy: postBusy, available: CAPACITY_PER_METHOD - postBusy },
  }
}

function userTarget(userId: string): Target | null {
  const user = db.prepare('SELECT id, latitude, longitude FROM users WHERE id = ?').get(userId) as { id: string; latitude: number; longitude: number } | undefined
  return user ? { id: user.id, lat: user.latitude, lon: user.longitude } : null
}

function branchTarget(branchId: string): Target | null {
  const branch = db.prepare('SELECT id, latitude, longitude FROM branches WHERE id = ? AND archived_at IS NULL').get(branchId) as { id: string; latitude: number; longitude: number } | undefined
  return branch ? { id: branch.id, lat: branch.latitude, lon: branch.longitude } : null
}

function isBranchMember(branchId: string, userId: string) {
  return Boolean(db.prepare('SELECT 1 FROM branch_memberships WHERE branch_id = ? AND user_id = ?').get(branchId, userId))
}

function isMutual(userId: string, otherId: string) {
  const row = db.prepare(
    `SELECT COUNT(*) AS count FROM follows
     WHERE status = 'ACCEPTED'
       AND ((follower_id = ? AND followed_id = ?) OR (follower_id = ? AND followed_id = ?))`,
  ).get(userId, otherId, otherId, userId) as { count: number }
  return row.count === 2
}

function homeContext(origin: GeoPoint): Context {
  const hub = findNearestHub(origin)
  return { recipientType: 'HOME', target: hub, branchId: null, recipientUserId: null }
}

function resolveBaseContext(type: MessageType, userId: string, origin: GeoPoint, destinationId: string) {
  if (type === 'HOME') return homeContext(origin)
  if (type === 'BRANCH') {
    const target = branchTarget(destinationId)
    if (!target || !isBranchMember(destinationId, userId)) return null
    return { recipientType: 'BRANCH' as const, target, branchId: destinationId, recipientUserId: null }
  }
  if (type === 'DIRECT') {
    const target = userTarget(destinationId)
    if (!target || !isMutual(userId, destinationId)) return null
    return { recipientType: 'USER' as const, target, branchId: null, recipientUserId: destinationId }
  }
  return null
}

function resolveReplyContext(parentMessageId: string, userId: string, origin: GeoPoint): Context | null {
  const parent = db.prepare(
    `SELECT message.author_id, message.recipient_user_id, message.branch_id,
            delivery.recipient_type
     FROM messages message
     JOIN deliveries delivery ON delivery.id = (
       SELECT selected.id FROM deliveries selected
       WHERE selected.message_id = message.id ORDER BY selected.sent_at DESC LIMIT 1
     )
     WHERE message.id = ?`,
  ).get(parentMessageId) as {
    author_id: string
    recipient_user_id: string | null
    branch_id: string | null
    recipient_type: RecipientType
  } | undefined
  if (!parent) return null
  if (parent.recipient_type === 'HOME') return homeContext(origin)
  if (parent.recipient_type === 'BRANCH' && parent.branch_id) {
    const target = branchTarget(parent.branch_id)
    if (!target || !isBranchMember(parent.branch_id, userId)) return null
    return { recipientType: 'BRANCH', target, branchId: parent.branch_id, recipientUserId: null }
  }
  const otherId = parent.author_id === userId ? parent.recipient_user_id : parent.author_id
  if (!otherId || !isMutual(userId, otherId)) return null
  const target = userTarget(otherId)
  return target ? { recipientType: 'USER', target, branchId: null, recipientUserId: otherId } : null
}

deliveriesRouter.get('/capacity', (req, res) => {
  const userId = String(req.query.userId ?? '')
  if (!userId) return res.status(400).json({ error: 'Utilisateur requis.' })
  const now = Math.floor(Date.now() / 1000)
  materializeArrivedBroadcasts(now)
  const rows = db.prepare(
    `SELECT d.id, d.method, d.recipient_type, d.recipient_id, d.origin_lat, d.origin_lon,
            d.destination_lat, d.destination_lon, d.sent_at, d.delivered_at,
            d.distance_km, d.timeline_json, m.type, m.source_message_id,
            recipient.username AS recipient_username, branch.name AS branch_name
     FROM deliveries d
     JOIN messages m ON m.id = d.message_id
     LEFT JOIN users recipient ON recipient.id = m.recipient_user_id
     LEFT JOIN branches branch ON branch.id = m.branch_id
     WHERE m.author_id = ? AND d.delivered_at > ?
     ORDER BY d.sent_at DESC LIMIT 10`,
  ).all(userId, now) as {
    recipient_type: RecipientType
    recipient_id: string | null
    type: string
    source_message_id: string | null
    recipient_username: string | null
    branch_name: string | null
  }[]
  const outgoing = rows.map((row) => {
    const destination = row.recipient_type === 'HOME'
      ? `Hub ${HUBS.find((hub) => hub.id === row.recipient_id)?.city ?? 'de diffusion'}`
      : row.recipient_type === 'BRANCH'
        ? row.branch_name ?? 'Branche'
        : row.recipient_username ?? 'Cui-to-cui'
    let routeIds: string[] = []
    try {
      const timeline = JSON.parse(String((row as { timeline_json?: string }).timeline_json ?? '{}')) as { route?: string[] }
      routeIds = timeline.route ?? []
    } catch {
      routeIds = []
    }
    return {
      ...row,
      route_points: routeIds.map((id) => HUBS.find((hub) => hub.id === id)).filter(Boolean),
      destination_label: row.type === 'REPLY'
        ? `Réponse · ${destination}`
        : row.source_message_id ? `Transmission · ${destination}` : destination,
    }
  })
  res.json({ capacity: capacity(userId), outgoing })
})

deliveriesRouter.post('/outbound', (req, res) => {
  const { userId, method, parentMessageId, sourceMessageId } = req.body ?? {}
  const requestedType = String(req.body?.type ?? 'HOME') as MessageType
  const destinationId = String(req.body?.destinationId ?? req.body?.destination?.id ?? '')
  if (typeof userId !== 'string' || !['BIRD', 'POST'].includes(method)) return res.status(400).json({ error: 'Envoi invalide.' })
  if (!['HOME', 'BRANCH', 'DIRECT', 'REPLY'].includes(requestedType)) return res.status(400).json({ error: 'Type invalide.' })
  const user = db.prepare('SELECT latitude, longitude FROM users WHERE id = ?').get(userId) as { latitude: number; longitude: number } | undefined
  if (!user) return res.status(404).json({ error: 'Compte introuvable.' })
  const origin = { lat: user.latitude, lon: user.longitude }

  const source = typeof sourceMessageId === 'string'
    ? db.prepare('SELECT id, content FROM messages WHERE id = ?').get(sourceMessageId) as { id: string; content: string } | undefined
    : undefined
  if (sourceMessageId && !source) return res.status(404).json({ error: 'Note source introuvable.' })
  const rawContent = source?.content ?? req.body?.content
  if (typeof rawContent !== 'string' || !rawContent.trim() || rawContent.length > 280) return res.status(400).json({ error: 'Note invalide.' })

  const context = requestedType === 'REPLY' && typeof parentMessageId === 'string'
    ? resolveReplyContext(parentMessageId, userId, origin)
    : resolveBaseContext(requestedType, userId, origin, destinationId)
  if (!context) return res.status(400).json({ error: 'Destination ou droits invalides.' })

  const now = Math.floor(Date.now() / 1000)
  const messageId = randomUUID()
  const deliveryId = randomUUID()
  const actionId = randomUUID()
  const route = method === 'BIRD'
    ? calculateBirdDelivery(origin, context.target, messageId, now, context.target.id)
    : calculatePostDelivery(origin, context.target, messageId, now, { receiverIsHub: context.recipientType === 'HOME' })
  const deliveredAt = route.estimatedDeliveryAt
  const physicalDistance = distanceKm(origin, context.target)

  try {
    db.transaction(() => {
      const currentCapacity = capacity(userId)
      if ((method === 'BIRD' ? currentCapacity.bird : currentCapacity.post).available <= 0) throw new Error('CAPACITY')
      db.prepare(
        `INSERT INTO messages (
           id, author_id, type, content, branch_id, recipient_user_id,
           parent_message_id, source_message_id, available_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        messageId, userId, requestedType, rawContent.trim(), context.branchId,
        context.recipientUserId, requestedType === 'REPLY' ? parentMessageId : null,
        source?.id ?? null, context.recipientType === 'USER' ? deliveredAt : null, now,
      )
      db.prepare(
        `INSERT INTO deliveries (
           id, message_id, recipient_type, recipient_id, method, origin_lat,
           origin_lon, destination_lat, destination_lon, sent_at, delivered_at,
           distance_km, timeline_json, origin_hub_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        deliveryId, messageId, context.recipientType, context.target.id, method,
        origin.lat, origin.lon, context.target.lat, context.target.lon, now,
        deliveredAt, physicalDistance, JSON.stringify(route),
        route.method === 'POST' ? route.originHub : context.recipientType === 'HOME' ? context.target.id : null,
      )
      db.prepare(
        `INSERT INTO pigeon_actions (id, user_id, message_id, action_type, started_at, busy_until)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(actionId, userId, messageId, method, now, deliveredAt)
    })()
  } catch (error) {
    if (error instanceof Error && error.message === 'CAPACITY') return res.status(409).json({ error: 'Plus de slot disponible pour cette méthode.' })
    throw error
  }
  materializeArrivedBroadcasts(now, messageId)
  res.status(201).json({
    message: { id: messageId }, capacity: capacity(userId),
    delivery: { id: deliveryId, method, origin, destination: context.target, sentAt: now, deliveredAt, distanceKm: physicalDistance, timeline: route },
  })
})
