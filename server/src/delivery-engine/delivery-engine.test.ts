import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateBirdDelivery } from './bird.js'
import { calculatePostDelivery } from './post.js'

const mondayMorning = Math.floor(Date.UTC(2026, 7, 24, 8, 0, 0) / 1000)

test('un pigeon à zéro kilomètre arrive immédiatement', () => {
  const point = { lat: 50.46119, lon: 3.56501 }
  const result = calculateBirdDelivery(point, point, 'zero-bird', mondayMorning, 'branch-local')
  assert.equal(result.distanceGpsKm, 0)
  assert.equal(result.estimatedDeliveryAt, mondayMorning)
})

test('un pigeon vole douze heures puis se repose douze heures', () => {
  // Au-delà de 12 h de vol, la règle calendaire ajoute un repos de 12 h.
  const point = { lat: 0, lon: 0 }
  const result = calculateBirdDelivery(point, { lat: 5, lon: 0 }, 'twelve-hours', mondayMorning, 'target')
  if (result.flightHours > 12) {
    assert.equal(result.calendarHours, 24 + (result.flightHours - 12))
  } else {
    assert.equal(result.calendarHours, result.flightHours)
  }
})

test('une lettre à zéro kilomètre conserve collecte et traitement postal', () => {
  const point = { lat: 50.46119, lon: 3.56501 }
  const result = calculatePostDelivery(point, point, 'zero-post', mondayMorning)
  assert.ok(result.estimatedDeliveryAt > mondayMorning + 4 * 3600)
  assert.ok(result.timeline.some((step) => step.type === 'COLLECTION'))
  assert.ok(result.timeline.some((step) => step.type === 'HUB_PROCESSING'))
  assert.ok(result.timeline.some((step) => step.type === 'FINAL_DELIVERY'))
})

test('une lettre Home s’arrête au hub et libère le slot à cette arrivée', () => {
  const sender = { lat: 50.46119, lon: 3.56501 }
  const parisHub = { lat: 48.8566, lon: 2.3522 }
  const result = calculatePostDelivery(sender, parisHub, 'home-post', mondayMorning, { receiverIsHub: true })
  assert.equal(result.destinationHub, 'EU_PAR')
  assert.ok(result.timeline.some((step) => step.type === 'COLLECTION'))
  assert.ok(result.timeline.some((step) => step.type === 'LOCAL_TRANSPORT'))
  assert.ok(!result.timeline.some((step) => step.type === 'FINAL_DELIVERY'))
})

test('une lettre interrégionale passe par des gateways', () => {
  const result = calculatePostDelivery(
    { lat: 50.46119, lon: 3.56501 },
    { lat: 35.6762, lon: 139.6503 },
    'inter-region', mondayMorning,
  )
  assert.ok(result.route.includes('EU_PAR'))
  assert.ok(result.route.includes('AS_TYO'))
  assert.ok(result.timeline.some((step) => step.type === 'INTER_HUB_TRANSPORT' && step.mode === 'PLANE'))
})
