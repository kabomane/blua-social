import { db } from './db.js'
import { calculateBirdDelivery } from '../delivery-engine/bird.js'
import { distanceKm } from '../delivery-engine/haversine.js'
import { calculatePostDelivery, findNearestHub } from '../delivery-engine/post.js'

type RecipientType = 'HOME' | 'BRANCH' | 'USER'

const replies = db.prepare(
  `SELECT reply.id AS message_id, reply.author_id, reply.parent_message_id,
          author.latitude AS origin_lat, author.longitude AS origin_lon,
          delivery.id AS delivery_id, delivery.method, delivery.sent_at,
          parent.author_id AS parent_author_id,
          parent.recipient_user_id AS parent_recipient_user_id,
          parent.branch_id AS parent_branch_id,
          parent_delivery.recipient_type AS expected_type
   FROM messages reply
   JOIN users author ON author.id = reply.author_id
   JOIN deliveries delivery ON delivery.message_id = reply.id
   JOIN messages parent ON parent.id = reply.parent_message_id
   JOIN deliveries parent_delivery ON parent_delivery.id = (
     SELECT selected.id FROM deliveries selected
     WHERE selected.message_id = parent.id ORDER BY selected.sent_at DESC LIMIT 1
   )
   WHERE reply.type = 'REPLY' AND delivery.recipient_type != parent_delivery.recipient_type
   ORDER BY reply.created_at`,
).all() as {
  message_id: string
  author_id: string
  parent_message_id: string
  origin_lat: number
  origin_lon: number
  delivery_id: string
  method: 'BIRD' | 'POST'
  sent_at: number
  parent_author_id: string
  parent_recipient_user_id: string | null
  parent_branch_id: string | null
  expected_type: RecipientType
}[]

let repaired = 0
db.transaction(() => {
  for (const reply of replies) {
    const origin = { lat: reply.origin_lat, lon: reply.origin_lon }
    let target: { id: string; lat: number; lon: number } | null = null
    let recipientUserId: string | null = null
    if (reply.expected_type === 'HOME') target = findNearestHub(origin)
    if (reply.expected_type === 'BRANCH' && reply.parent_branch_id) {
      const branch = db.prepare('SELECT id, latitude, longitude FROM branches WHERE id = ?').get(reply.parent_branch_id) as { id: string; latitude: number; longitude: number } | undefined
      if (branch) target = { id: branch.id, lat: branch.latitude, lon: branch.longitude }
    }
    if (reply.expected_type === 'USER') {
      recipientUserId = reply.parent_author_id === reply.author_id ? reply.parent_recipient_user_id : reply.parent_author_id
      const user = recipientUserId
        ? db.prepare('SELECT id, latitude, longitude FROM users WHERE id = ?').get(recipientUserId) as { id: string; latitude: number; longitude: number } | undefined
        : undefined
      if (user) target = { id: user.id, lat: user.latitude, lon: user.longitude }
    }
    if (!target) continue
    const route = reply.method === 'BIRD'
      ? calculateBirdDelivery(origin, target, reply.message_id, reply.sent_at, target.id)
      : calculatePostDelivery(origin, target, reply.message_id, reply.sent_at, { receiverIsHub: reply.expected_type === 'HOME' })
    db.prepare(
      `UPDATE messages SET branch_id = ?, recipient_user_id = ?, available_at = ? WHERE id = ?`,
    ).run(
      reply.expected_type === 'BRANCH' ? reply.parent_branch_id : null,
      recipientUserId,
      reply.expected_type === 'USER' ? route.estimatedDeliveryAt : null,
      reply.message_id,
    )
    db.prepare(
      `UPDATE deliveries SET recipient_type = ?, recipient_id = ?, destination_lat = ?,
         destination_lon = ?, delivered_at = ?, distance_km = ?, timeline_json = ?, origin_hub_id = ?
       WHERE id = ?`,
    ).run(
      reply.expected_type, target.id, target.lat, target.lon, route.estimatedDeliveryAt,
      distanceKm(origin, target), JSON.stringify(route), route.method === 'POST' ? route.originHub : reply.expected_type === 'HOME' ? target.id : null,
      reply.delivery_id,
    )
    db.prepare('UPDATE pigeon_actions SET busy_until = ? WHERE message_id = ?').run(route.estimatedDeliveryAt, reply.message_id)
    db.prepare('DELETE FROM broadcast_bitmap_chunks WHERE broadcast_id IN (SELECT id FROM broadcasts WHERE message_id = ?)').run(reply.message_id)
    db.prepare('DELETE FROM broadcasts WHERE message_id = ?').run(reply.message_id)
    repaired += 1
  }
})()

console.log(`context deliveries repaired: ${repaired}`)
