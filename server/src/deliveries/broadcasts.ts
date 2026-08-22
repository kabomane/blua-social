import { randomUUID } from 'node:crypto'
import { db } from '../database/db.js'
import { calculateBirdDelivery } from '../delivery-engine/bird.js'
import { calculatePostDelivery } from '../delivery-engine/post.js'
import { DELIVERY_RULES } from '../delivery-engine/rules.js'

type AudienceType = 'HOME' | 'BRANCH'
type Method = 'BIRD' | 'POST'

interface BroadcastRow {
  id: string
  message_id: string
  audience_type: AudienceType
  origin_type: 'HUB' | 'BRANCH'
  origin_id: string
  origin_lat: number
  origin_lon: number
  method: Method
  distribution_started_at: number
  settled_at: number
  author_id: string
  branch_id: string | null
  parent_message_id: string | null
}

function settledAt(method: Method, startedAt: number) {
  const days = method === 'BIRD' ? DELIVERY_RULES.broadcast.birdMaxDays : DELIVERY_RULES.broadcast.postMaxDays
  return startedAt + days * 86400
}

export function materializeArrivedBroadcasts(now: number, messageId?: string) {
  const rows = db.prepare(
    `SELECT d.message_id, d.recipient_type, d.recipient_id, d.destination_lat,
            d.destination_lon, d.method, d.delivered_at
     FROM deliveries d
     LEFT JOIN broadcasts broadcast ON broadcast.message_id = d.message_id
     WHERE d.recipient_type IN ('HOME', 'BRANCH')
       AND d.delivered_at <= ? AND broadcast.id IS NULL
       AND (? IS NULL OR d.message_id = ?)`,
  ).all(now, messageId ?? null, messageId ?? null) as {
    message_id: string
    recipient_type: AudienceType
    recipient_id: string
    destination_lat: number
    destination_lon: number
    method: Method
    delivered_at: number
  }[]

  const insert = db.prepare(
    `INSERT OR IGNORE INTO broadcasts (
       id, message_id, audience_type, origin_type, origin_id, origin_lat,
       origin_lon, method, distribution_started_at, settled_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  db.transaction(() => {
    for (const row of rows) {
      insert.run(
        randomUUID(), row.message_id, row.recipient_type,
        row.recipient_type === 'HOME' ? 'HUB' : 'BRANCH', row.recipient_id,
        row.destination_lat, row.destination_lon, row.method, row.delivered_at,
        settledAt(row.method, row.delivered_at),
      )
    }
    db.prepare('DELETE FROM broadcast_bitmap_chunks WHERE broadcast_id IN (SELECT id FROM broadcasts WHERE settled_at <= ?)').run(now)
  })()
}

function homeEligible(broadcast: BroadcastRow, userId: string) {
  if (broadcast.author_id === userId) return true
  const directParentAuthor = broadcast.parent_message_id
    ? db.prepare('SELECT author_id FROM messages WHERE id = ?').get(broadcast.parent_message_id) as { author_id: string } | undefined
    : undefined
  if (directParentAuthor?.author_id === userId) return true
  return Boolean(db.prepare(
    `SELECT 1
     WHERE EXISTS (
       SELECT 1 FROM follow_periods period
       WHERE period.follower_id = ? AND period.followed_id = ?
         AND period.started_at <= ?
         AND (period.ended_at IS NULL OR period.ended_at > ?)
     ) OR EXISTS (
       SELECT 1 FROM follows follow
       WHERE follow.follower_id = ? AND follow.followed_id = ?
         AND follow.status = 'ACCEPTED' AND follow.created_at <= ?
     )`,
  ).get(userId, broadcast.author_id, broadcast.distribution_started_at, broadcast.distribution_started_at, userId, broadcast.author_id, broadcast.distribution_started_at))
}

function branchEligible(broadcast: BroadcastRow, userId: string) {
  if (!broadcast.branch_id) return false
  return Boolean(db.prepare(
    `SELECT 1
     WHERE EXISTS (
       SELECT 1 FROM branch_membership_periods period
       WHERE period.branch_id = ? AND period.user_id = ?
         AND period.joined_at <= ?
         AND (period.left_at IS NULL OR period.left_at > ?)
     ) OR EXISTS (
       SELECT 1 FROM branch_memberships membership
       WHERE membership.branch_id = ? AND membership.user_id = ?
         AND membership.joined_at <= ?
     )`,
  ).get(broadcast.branch_id, userId, broadcast.distribution_started_at, broadcast.distribution_started_at, broadcast.branch_id, userId, broadcast.distribution_started_at))
}

function homeSlot(publisherId: string, recipientId: string, assignedAt: number) {
  const existing = db.prepare(
    'SELECT slot_index FROM home_recipient_slots WHERE publisher_user_id = ? AND recipient_user_id = ?',
  ).get(publisherId, recipientId) as { slot_index: number } | undefined
  if (existing) return existing.slot_index
  const next = db.prepare(
    'SELECT COALESCE(MAX(slot_index), -1) + 1 AS slot_index FROM home_recipient_slots WHERE publisher_user_id = ?',
  ).get(publisherId) as { slot_index: number }
  db.prepare(
    `INSERT INTO home_recipient_slots (publisher_user_id, recipient_user_id, slot_index, assigned_at)
     VALUES (?, ?, ?, ?)`,
  ).run(publisherId, recipientId, next.slot_index, assignedAt)
  return next.slot_index
}

function branchSlot(branchId: string, userId: string, startedAt: number) {
  const existing = db.prepare(
    `SELECT slot_index FROM branch_membership_periods
     WHERE branch_id = ? AND user_id = ? AND joined_at <= ?
       AND (left_at IS NULL OR left_at > ?)
     ORDER BY joined_at DESC LIMIT 1`,
  ).get(branchId, userId, startedAt, startedAt) as { slot_index: number } | undefined
  if (existing) return existing.slot_index
  const membership = db.prepare(
    'SELECT role, joined_at FROM branch_memberships WHERE branch_id = ? AND user_id = ? AND joined_at <= ?',
  ).get(branchId, userId, startedAt) as { role: string; joined_at: number } | undefined
  if (!membership) return null
  const next = db.prepare(
    'SELECT COALESCE(MAX(slot_index), -1) + 1 AS slot_index FROM branch_membership_periods WHERE branch_id = ?',
  ).get(branchId) as { slot_index: number }
  db.prepare(
    `INSERT INTO branch_membership_periods (id, branch_id, user_id, slot_index, role, joined_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), branchId, userId, next.slot_index, membership.role, membership.joined_at)
  return next.slot_index
}

function hasReceivedBit(broadcastId: string, slot: number) {
  const chunkIndex = Math.floor(slot / 512)
  const bitIndex = slot % 512
  const row = db.prepare(
    'SELECT received_bits FROM broadcast_bitmap_chunks WHERE broadcast_id = ? AND chunk_index = ?',
  ).get(broadcastId, chunkIndex) as { received_bits: Buffer } | undefined
  if (!row) return false
  return ((row.received_bits[Math.floor(bitIndex / 8)] ?? 0) & (1 << (bitIndex % 8))) !== 0
}

function setReceivedBit(broadcastId: string, slot: number) {
  const chunkIndex = Math.floor(slot / 512)
  const bitIndex = slot % 512
  const byteIndex = Math.floor(bitIndex / 8)
  const mask = 1 << (bitIndex % 8)
  db.transaction(() => {
    const row = db.prepare(
      'SELECT received_bits FROM broadcast_bitmap_chunks WHERE broadcast_id = ? AND chunk_index = ?',
    ).get(broadcastId, chunkIndex) as { received_bits: Buffer } | undefined
    const bits = row ? Buffer.from(row.received_bits) : Buffer.alloc(64)
    bits[byteIndex] = (bits[byteIndex] ?? 0) | mask
    db.prepare(
      `INSERT INTO broadcast_bitmap_chunks (broadcast_id, chunk_index, received_bits)
       VALUES (?, ?, ?)
       ON CONFLICT(broadcast_id, chunk_index) DO UPDATE SET received_bits = excluded.received_bits`,
    ).run(broadcastId, chunkIndex, bits)
  })()
}

export function resolveBroadcastAccess(messageId: string, userId: string, now: number) {
  materializeArrivedBroadcasts(now, messageId)
  const broadcast = db.prepare(
    `SELECT broadcast.*, message.author_id, message.branch_id, message.parent_message_id
     FROM broadcasts broadcast
     JOIN messages message ON message.id = broadcast.message_id
     WHERE broadcast.message_id = ?`,
  ).get(messageId) as BroadcastRow | undefined
  if (!broadcast) return false
  const eligible = broadcast.audience_type === 'HOME'
    ? homeEligible(broadcast, userId)
    : branchEligible(broadcast, userId)
  if (!eligible) return false
  if (now >= broadcast.settled_at) return true

  const slot = db.transaction(() => broadcast.audience_type === 'HOME'
    ? homeSlot(broadcast.author_id, userId, broadcast.distribution_started_at)
    : branchSlot(broadcast.branch_id ?? '', userId, broadcast.distribution_started_at))()
  if (slot === null || slot === undefined) return false
  if (hasReceivedBit(broadcast.id, slot)) return true

  const user = db.prepare('SELECT latitude, longitude FROM users WHERE id = ?').get(userId) as { latitude: number; longitude: number } | undefined
  if (!user) return false
  const origin = { lat: broadcast.origin_lat, lon: broadcast.origin_lon }
  const destination = { lat: user.latitude, lon: user.longitude }
  const arrival = broadcast.method === 'BIRD'
    ? calculateBirdDelivery(origin, destination, broadcast.message_id, broadcast.distribution_started_at, userId).estimatedDeliveryAt
    : calculatePostDelivery(origin, destination, `${broadcast.message_id}:${userId}`, broadcast.distribution_started_at, {
        senderIsHub: broadcast.origin_type === 'HUB',
      }).estimatedDeliveryAt
  if (arrival > now) return false
  setReceivedBit(broadcast.id, slot)
  return true
}
