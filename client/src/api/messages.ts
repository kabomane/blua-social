export interface FeedReply {
  id: string
  author: string
  handle: string
  text: string
  arrivedAt: number
}

export interface FeedMessage {
  id: string
  authorId: string
  author: string
  handle: string
  avatarUrl: string | null
  text: string
  method: 'BIRD' | 'POST'
  distanceKm: number | null
  arrivedAt: number
  pending: boolean
  transmissions: number
  replies: FeedReply[]
}

export interface PendingMessage {
  id: string
  type: 'HOME' | 'BRANCH' | 'DIRECT'
  text: string
  method: 'BIRD' | 'POST'
  distanceKm: number | null
  createdAt: number
  deliveredAt: number
  destinationLabel: string
}

export async function getHomeFeed(userId: string): Promise<FeedMessage[]> {
  const response = await fetch(`/api/messages/feed?userId=${encodeURIComponent(userId)}`)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? 'Impossible de charger les messages.')
  return body.messages as FeedMessage[]
}

export async function getPendingMessages(
  userId: string,
  type?: PendingMessage['type'],
): Promise<PendingMessage[]> {
  const params = new URLSearchParams({ userId })
  if (type) params.set('type', type)
  const response = await fetch(`/api/messages/pending?${params}`)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? 'Impossible de charger les envois en cours.')
  return body.messages as PendingMessage[]
}
