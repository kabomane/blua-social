export function formatArrivalAge(arrivedAt: number, now = new Date()): string {
  const date = new Date(arrivedAt)
  const elapsedMs = Math.max(0, now.getTime() - arrivedAt)
  const minutes = Math.floor(elapsedMs / 60_000)
  const hours = Math.floor(elapsedMs / 3_600_000)
  const days = Math.floor(elapsedMs / 86_400_000)
  const isToday = date.toDateString() === now.toDateString()

  if (isToday && date.getHours() < 6) return 'cette nuit'
  if (minutes < 1) return 'maintenant'
  if (minutes < 60) return `${minutes} min`
  if (isToday) return `${hours}h`

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'hier'
  if (days < 30) return `${days}j`

  const months = Math.floor(days / 30)
  if (months < 24) return `${months} mois`
  return `${Math.floor(months / 12)} ans`
}
