export interface User {
  id: string
  email: string | null
  username: string
  city: string | null
  locationCheckedAt: number | null
  avatarUrl: string | null
}

async function post(path: string, body: unknown): Promise<User> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Erreur serveur.')
  return data.user as User
}

export interface RegisterPayload {
  email: string
  password: string
  username: string
  latitude: number
  longitude: number
  timezone: string
}

export const register = (payload: RegisterPayload) =>
  post('/api/auth/register', payload)

export const login = (email: string, password: string) =>
  post('/api/auth/login', { email, password })

export async function updateLocation(userId: string, latitude: number, longitude: number): Promise<User> {
  const res = await fetch('/api/auth/location', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, latitude, longitude, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Impossible de mettre à jour la localisation.')
  return data.user as User
}

export async function uploadAvatar(userId: string, file: File): Promise<User> {
  const res = await fetch('/api/auth/avatar', {
    method: 'PUT',
    headers: { 'Content-Type': file.type, 'X-User-Id': userId },
    body: file,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Impossible d’enregistrer cette photo.')
  return data.user as User
}

async function check(path: string): Promise<boolean> {
  const res = await fetch(path)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Erreur serveur.')
  return data.available as boolean
}

export const checkEmail = (email: string) =>
  check('/api/auth/check-email?email=' + encodeURIComponent(email))

export const checkUsername = (username: string) =>
  check('/api/auth/check-username?username=' + encodeURIComponent(username))

// Session locale — IndexedDB "blua-local"
import { kvDel, kvGet, kvSet } from '../lib/blua-local'

const KEY = 'session:user'

export const storedUser = () => kvGet<User>(KEY)
export const storeUser = (u: User) => kvSet(KEY, u)
export const clearUser = () => kvDel(KEY)
