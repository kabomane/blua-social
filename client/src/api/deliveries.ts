export interface Capacity {
  bird: { total: number; busy: number; available: number }
  post: { total: number; busy: number; available: number }
}

export interface OutgoingDelivery {
  id: string
  method: 'BIRD' | 'POST'
  recipient_id: string | null
  destination_label: string
  origin_lat: number
  origin_lon: number
  destination_lat: number
  destination_lon: number
  sent_at: number
  delivered_at: number
  distance_km: number
  timeline_json: string
  type: string
  route_points: { id: string; city: string; lat: number; lon: number }[]
}

async function data<T>(response: Promise<Response>): Promise<T> {
  const resolved = await response
  const body = await resolved.json().catch(() => ({}))
  if (!resolved.ok) throw new Error(body.error ?? 'Erreur serveur.')
  return body as T
}

export const getCapacity = (userId: string) =>
  data<{ capacity: Capacity; outgoing: OutgoingDelivery[] }>(fetch(`/api/deliveries/capacity?userId=${encodeURIComponent(userId)}`))

export const sendHome = (userId: string, content: string, method: 'BIRD' | 'POST') =>
  data<{ capacity: Capacity }>(fetch('/api/deliveries/outbound', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, content, method, type: 'HOME' }),
  }))

export const sendBranch = (
  userId: string,
  branchId: string,
  content: string,
  method: 'BIRD' | 'POST',
) => data<{ capacity: Capacity }>(fetch('/api/deliveries/outbound', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId, destinationId: branchId, content, method, type: 'BRANCH' }),
}))

export const sendReply = (
  userId: string,
  parentMessageId: string,
  content: string,
  method: 'BIRD' | 'POST',
) => data<{ message: { id: string }; capacity: Capacity }>(fetch('/api/deliveries/outbound', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId, parentMessageId, content, method, type: 'REPLY' }),
}))

export const sendTransmission = (
  userId: string,
  sourceMessageId: string,
  method: 'BIRD' | 'POST',
) => data<{ message: { id: string }; capacity: Capacity }>(fetch('/api/deliveries/outbound', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId, sourceMessageId, method, type: 'HOME' }),
}))
