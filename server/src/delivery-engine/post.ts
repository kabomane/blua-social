import type { GeoPoint } from './haversine.js'
import { distanceKm } from './haversine.js'
import { GATEWAYS, HUBS, type Hub } from './hubs.js'
import { DELIVERY_RULES, HOLIDAYS } from './rules.js'
import { seededRandomBetween } from './seeded-random.js'

export type PostTimelineStepType =
  | 'SENT' | 'COLLECTION' | 'LOCAL_TRANSPORT' | 'HUB_PROCESSING'
  | 'WAITING_DEPARTURE' | 'INTER_HUB_TRANSPORT' | 'FINAL_DELIVERY' | 'DELIVERED'

export interface PostTimelineStep {
  type: PostTimelineStepType
  hub?: string
  from?: string
  to?: string
  mode?: 'GROUND' | 'FAST_GROUND' | 'PLANE'
  distanceKm?: number
  start?: number
  end?: number
}

export interface PostDeliveryResult {
  method: 'POST'
  originHub: string
  destinationHub: string
  route: string[]
  timeline: PostTimelineStep[]
  sentAt: number
  estimatedDeliveryAt: number
}

export interface PostDeliveryOptions {
  senderIsHub?: boolean
  receiverIsHub?: boolean
}

const rules = DELIVERY_RULES.post
const HOUR_SECONDS = 3600

interface LocalParts {
  year: number
  month: number
  day: number
  weekday: string
  hour: number
  minute: number
  second: number
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function localParts(timestamp: number, timezone: string): LocalParts {
  let formatter = formatters.get(timezone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    })
    formatters.set(timezone, formatter)
  }
  const values = Object.fromEntries(formatter.formatToParts(new Date(timestamp * 1000)).map((part) => [part.type, part.value]))
  return {
    year: Number(values.year), month: Number(values.month), day: Number(values.day),
    weekday: values.weekday ?? '', hour: Number(values.hour), minute: Number(values.minute), second: Number(values.second),
  }
}

function isHoliday(hub: Hub, local: LocalParts) {
  const date = `${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`
  return HOLIDAYS.some((holiday) => holiday.region === hub.region && holiday.date === date)
}

function workRate(hub: Hub, timestamp: number) {
  const local = localParts(timestamp, hub.timezone)
  if (isHoliday(hub, local) || local.weekday === 'Sun') return 0
  const decimalHour = local.hour + local.minute / 60 + local.second / HOUR_SECONDS
  if (local.weekday === 'Sat') {
    return decimalHour >= rules.saturdayOpenHour && decimalHour < rules.saturdayCloseHour
      ? rules.saturdayEfficiency
      : 0
  }
  return decimalHour >= rules.weekdayOpenHour && decimalHour < rules.weekdayCloseHour ? 1 : 0
}

function nextOperatingTime(hub: Hub, timestamp: number) {
  let cursor = Math.ceil(timestamp / 60) * 60
  while (workRate(hub, cursor) === 0) cursor += 60
  return cursor
}

function consumeWorkingHours(hub: Hub, timestamp: number, hours: number) {
  let cursor = nextOperatingTime(hub, timestamp)
  let remainingSeconds = hours * HOUR_SECONDS
  while (remainingSeconds > 0.001) {
    const rate = workRate(hub, cursor)
    if (rate === 0) {
      cursor = nextOperatingTime(hub, cursor)
      continue
    }
    const slice = Math.min(60, remainingSeconds / rate)
    cursor += slice
    remainingSeconds -= slice * rate
  }
  return Math.ceil(cursor)
}

export function findNearestHub(point: GeoPoint) {
  return HUBS.reduce((nearest, hub) => distanceKm(point, hub) < distanceKm(point, nearest) ? hub : nearest)
}

function nearestGateway(hub: Hub) {
  return GATEWAYS.filter((candidate) => candidate.region === hub.region)
    .reduce((nearest, candidate) => distanceKm(hub, candidate) < distanceKm(hub, nearest) ? candidate : nearest)
}

function routeFor(origin: Hub, destination: Hub) {
  const route = origin.region === destination.region
    ? [origin, destination]
    : [origin, origin.gateway ? origin : nearestGateway(origin), destination.gateway ? destination : nearestGateway(destination), destination]
  return route.filter((hub, index) => index === 0 || hub.id !== route[index - 1]!.id)
}

function transport(a: Hub, b: Hub) {
  const distance = distanceKm(a, b)
  if (a.region !== b.region) return { mode: 'PLANE' as const, speed: rules.planeSpeedKmH, frequency: rules.internationalPlaneFrequencyHours, distance }
  if (distance < 500) return { mode: 'GROUND' as const, speed: rules.groundSpeedKmH, frequency: rules.groundDepartureFrequencyHours, distance }
  if (distance < 1500) return { mode: 'FAST_GROUND' as const, speed: rules.fastGroundSpeedKmH, frequency: rules.fastGroundDepartureFrequencyHours, distance }
  return { mode: 'PLANE' as const, speed: rules.planeSpeedKmH, frequency: rules.regionalPlaneFrequencyHours, distance }
}

function nextDeparture(hub: Hub, timestamp: number, frequency: number) {
  let cursor = Math.ceil(timestamp / 60) * 60
  while (true) {
    const local = localParts(cursor, hub.timezone)
    if (local.minute === 0 && local.second === 0 && local.hour % frequency === 0) return cursor
    cursor += 60
  }
}

export function calculatePostDelivery(
  sender: GeoPoint,
  receiver: GeoPoint,
  messageId: string,
  sentAt: number,
  options: PostDeliveryOptions = {},
): PostDeliveryResult {
  const origin = findNearestHub(sender)
  const destination = findNearestHub(receiver)
  const route = routeFor(origin, destination)
  const timeline: PostTimelineStep[] = [{ type: 'SENT', start: sentAt, end: sentAt }]
  let current = sentAt

  if (!options.senderIsHub) {
    const collectionHours = seededRandomBetween(`${messageId}:COLLECTION`, rules.collectionMinHours, rules.collectionMaxHours)
    const collectionStart = nextOperatingTime(origin, current)
    current = consumeWorkingHours(origin, collectionStart, collectionHours)
    timeline.push({ type: 'COLLECTION', from: 'sender', to: origin.id, start: collectionStart, end: current })
    const localStart = current
    const localDistance = distanceKm(sender, origin)
    current += Math.ceil(Math.max(localDistance / rules.localSpeedKmH, rules.localMinHours) * HOUR_SECONDS)
    timeline.push({ type: 'LOCAL_TRANSPORT', from: 'sender', to: origin.id, distanceKm: localDistance, start: localStart, end: current })
  }

  // Un post Home s'arrête au hub : pas de traitement ni distribution finale.
  if (!options.receiverIsHub) {
    for (let index = 0; index < route.length; index += 1) {
      const hub = route[index]!
      const processingHours = hub.gateway
        ? seededRandomBetween(`${messageId}:HUB:${hub.id}`, rules.gatewayProcessingMinHours, rules.gatewayProcessingMaxHours)
        : seededRandomBetween(`${messageId}:HUB:${hub.id}`, rules.normalHubProcessingMinHours, rules.normalHubProcessingMaxHours)
      const processingStart = nextOperatingTime(hub, current)
      current = consumeWorkingHours(hub, processingStart, processingHours)
      timeline.push({ type: 'HUB_PROCESSING', hub: hub.id, start: processingStart, end: current })

      const nextHub = route[index + 1]
      if (!nextHub) continue
      const leg = transport(hub, nextHub)
      const departure = nextDeparture(hub, current, leg.frequency)
      if (departure > current) timeline.push({ type: 'WAITING_DEPARTURE', hub: hub.id, start: current, end: departure })
      const arrival = departure + Math.ceil(leg.distance / leg.speed * HOUR_SECONDS)
      timeline.push({ type: 'INTER_HUB_TRANSPORT', from: hub.id, to: nextHub.id, mode: leg.mode, distanceKm: leg.distance, start: departure, end: arrival })
      current = arrival
    }

    const finalDistance = distanceKm(destination, receiver)
    const finalWorkHours = Math.max(finalDistance / rules.localSpeedKmH, rules.localMinHours)
      + seededRandomBetween(`${messageId}:FINAL`, rules.finalDeliveryMinHours, rules.finalDeliveryMaxHours)
    const finalStart = nextOperatingTime(destination, current)
    current = consumeWorkingHours(destination, finalStart, finalWorkHours)
    timeline.push({ type: 'FINAL_DELIVERY', from: destination.id, to: 'receiver', distanceKm: finalDistance, start: finalStart, end: current })
  }

  timeline.push({ type: 'DELIVERED', start: current, end: current })
  return {
    method: 'POST', originHub: origin.id, destinationHub: destination.id,
    route: route.map((hub) => hub.id), timeline, sentAt, estimatedDeliveryAt: current,
  }
}
