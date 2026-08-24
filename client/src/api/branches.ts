export interface BranchSummary {
  id: string
  name: string
  visibility: 'PUBLIC' | 'PRIVATE'
  role: 'OWNER' | 'MODERATOR' | 'MEMBER' | null
  memberCount: number
  distanceKm: number
  createdAt: number
}

async function data<T>(response: Promise<Response>): Promise<T> {
  const resolved = await response
  const body = await resolved.json().catch(() => ({}))
  if (!resolved.ok) throw new Error(body.error ?? 'Erreur serveur.')
  return body as T
}

export const getBranches = (userId: string, view: 'mine' | 'discover') =>
  data<{ branches: BranchSummary[] }>(fetch(
    `/api/branches?userId=${encodeURIComponent(userId)}&view=${view}`,
  ))

export const createBranch = (
  userId: string,
  name: string,
  visibility: 'PUBLIC' | 'PRIVATE',
  position: { latitude: number; longitude: number },
) => data<{ branch: BranchSummary }>(fetch('/api/branches', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId, name, visibility, ...position }),
}))
