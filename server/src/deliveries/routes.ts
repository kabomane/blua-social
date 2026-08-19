import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { db } from '../database/db.js'
import { calculateBirdDelivery } from '../delivery-engine/bird.js'
import { distanceKm, type GeoPoint } from '../delivery-engine/haversine.js'
import { HUBS } from '../delivery-engine/hubs.js'

export const deliveriesRouter: Router = Router()

const CAPACITY_PER_METHOD = 5
type Method = 'BIRD' | 'POST'

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

function nearestHub(origin: GeoPoint) {
  return HUBS.reduce((nearest, hub) => distanceKm(origin, hub) < distanceKm(origin, nearest) ? hub : nearest)
}

// Le suivi ne retourne que les coordonnées de l'expéditeur et de la
// destination physique du premier trajet, jamais celles d'un tiers.
deliveriesRouter.get('/capacity', (req, res) => {
  const userId = String(req.query.userId ?? '')
  if (!userId) return res.status(400).json({ error: 'Utilisateur requis.' })
  const rows = db.prepare(
    `SELECT d.id, d.method, d.recipient_id, d.origin_lat, d.origin_lon, d.destination_lat, d.destination_lon,
            d.sent_at, d.delivered_at, d.distance_km, d.timeline_json, m.type
     FROM deliveries d JOIN messages m ON m.id = d.message_id
     WHERE m.author_id = ? AND d.delivered_at > ? ORDER BY d.sent_at DESC LIMIT 10`,
  ).all(userId, Math.floor(Date.now() / 1000)) as { recipient_id: string | null; type: string }[]
  const outgoing = rows.map((row) => ({
    ...row,
    destination_label: row.type === 'HOME'
      ? `Hub ${HUBS.find((hub) => hub.id === row.recipient_id)?.city ?? 'de diffusion'}`
      : 'Destination',
  }))
  res.json({ capacity: capacity(userId), outgoing })
})

// Première brique commune Home/Branch/Direct. Chaque appel crée UN trajet
// physique et bloque UN slot jusqu'à son arrivée. Home cible le hub proche.
deliveriesRouter.post('/outbound', (req, res) => {
  const { userId, content, method, type = 'HOME', destination } = req.body ?? {}
  if (typeof userId !== 'string' || !['BIRD', 'POST'].includes(method)) return res.status(400).json({ error: 'Envoi invalide.' })
  if (typeof content !== 'string' || !content.trim() || content.length > 280) return res.status(400).json({ error: 'Note invalide.' })
  const user = db.prepare('SELECT latitude, longitude FROM users WHERE id = ?').get(userId) as { latitude: number; longitude: number } | undefined
  if (!user) return res.status(404).json({ error: 'Compte introuvable.' })
  const origin = { lat: user.latitude, lon: user.longitude }
  const target = type === 'HOME'
    ? nearestHub(origin)
    : destination && typeof destination.lat === 'number' && typeof destination.lon === 'number'
      ? { lat: destination.lat, lon: destination.lon, id: String(destination.id ?? '') }
      : null
  if (!target) return res.status(400).json({ error: 'Destination invalide.' })
  const now = Math.floor(Date.now() / 1000)
  const messageId = randomUUID()
  const deliveryId = randomUUID()
  const actionId = randomUUID()
  const route = method === 'BIRD'
    ? calculateBirdDelivery(origin, target, messageId, now)
    : null
  // Poste: premier tronçon réel collecte + acheminement local vers hub/point.
  const postHours = Math.max(distanceKm(origin, target) / 65, 2) + 2
  const deliveredAt = route?.estimatedDeliveryAt ?? now + Math.ceil(postHours * 3600)
  const timeline = route ?? { method: 'POST', steps: ['COLLECTE', 'ACHEMINEMENT LOCAL'], estimatedDeliveryAt: deliveredAt }

  try {
    db.transaction(() => {
      const currentCapacity = capacity(userId)
      if ((method === 'BIRD' ? currentCapacity.bird : currentCapacity.post).available <= 0) throw new Error('CAPACITY')
      db.prepare('INSERT INTO messages (id, author_id, type, content, created_at) VALUES (?, ?, ?, ?, ?)').run(messageId, userId, type, content.trim(), now)
      db.prepare(
        `INSERT INTO deliveries (id, message_id, recipient_type, recipient_id, method, origin_lat, origin_lon, destination_lat, destination_lon, sent_at, delivered_at, distance_km, timeline_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(deliveryId, messageId, type === 'HOME' ? 'HOME' : 'USER', target.id ?? null, method, origin.lat, origin.lon, target.lat, target.lon, now, deliveredAt, route?.distanceGpsKm ?? distanceKm(origin, target), JSON.stringify(timeline))
      db.prepare('INSERT INTO pigeon_actions (id, user_id, message_id, action_type, started_at, busy_until) VALUES (?, ?, ?, ?, ?, ?)').run(actionId, userId, messageId, method, now, deliveredAt)
    })()
  } catch (error) {
    if (error instanceof Error && error.message === 'CAPACITY') return res.status(409).json({ error: 'Plus de slot disponible pour cette méthode.' })
    throw error
  }
  res.status(201).json({ capacity: capacity(userId), delivery: { id: deliveryId, method, origin, destination: target, sentAt: now, deliveredAt, distanceKm: route?.distanceGpsKm ?? distanceKm(origin, target), timeline } })
})
