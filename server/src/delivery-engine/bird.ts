// TODO — Moteur de livraison OISEAU (docs/send method.txt Partie A,
// docs/update pigeon speed.txt).
//
// PRINCIPE : trajet direct A → B, ignore totalement hubs/régions/horaires.
//
// ALGORITHME (calculé UNE SEULE FOIS à l'envoi, jamais recalculé) :
// 1. distance GPS (Haversine) ;
// 2. distance effective = distance × routeFactor (1.10) ;
// 3. vitesse : distribution triangulaire déterministe 40-60 km/h,
//    centrée sur 50 — deux tirages seedés `${messageId}:speed:1` et `:speed:2`,
//    normalized = (r1 + r2) / 2, speed = 40 + normalized × 20 ;
// 4. flightHours = distance effective / vitesse ;
// 5. journées de vol : 8 h de vol / 24 h (16 h de repos), sans ajouter le
//    repos final inutile (voir §10 pour la formule calendaire précise) ;
// 6. estimatedDeliveryAt = sentAt + calendarHours.
//
// Position visuelle : interpolation linéaire origine → destination (§12).
//
// HOME (docs/home_posts_via_hub.txt) : appeler ce calcul une première fois
// auteur → hub proche. L'heure d'arrivée de ce premier trajet devient le
// busy_until du pigeon personnel. Les livraisons hub → amis sont ensuite des
// voyages distincts : elles ne prolongent jamais ce busy_until.

import type { GeoPoint } from './haversine.js'

export interface BirdDeliveryResult {
  method: 'BIRD'
  birdId: string
  distanceGpsKm: number
  effectiveDistanceKm: number
  effectiveSpeedKmH: number
  flightHours: number
  calendarHours: number
  sentAt: number
  estimatedDeliveryAt: number
}

export function calculateBirdDelivery(
  _sender: GeoPoint,
  _receiver: GeoPoint,
  _messageId: string,
  _sentAt: number,
): BirdDeliveryResult {
  throw new Error('Not implemented — voir docs/send method.txt §46 (BIRD)')
}
