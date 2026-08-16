// TODO — Moteur de livraison POSTE (docs/send method.txt Partie B).
//
// PRINCIPE : le message traverse une infrastructure (40 hubs, 5 régions,
// 10 gateways). Lent sur courte distance, efficace sur longue distance.
//
// ALGORITHME (§37, calculé UNE SEULE FOIS à l'envoi) :
// 1. originHub / destinationHub = hub le plus proche parmi les 40 (§22) ;
// 2. même région → [origin, destination] ; sinon
//    [origin, originGateway, destinationGateway, destination] —
//    pas de gateway ajoutée si le hub en est déjà une (§24-25) ;
// 3. supprimer les doublons adjacents de la route (§26) ;
// 4. collecte : 2-6 h déterministe (§27) ;
// 5. transport local user → hub : max(distance / 65, 2 h) (§28) ;
// 6. par hub : attendre l'ouverture, traiter (normal 5-12 h, gateway 8-16 h)
//    en respectant horaires 06-22, samedi 08-16 à 50 %, dimanche fermé,
//    jours fériés = dimanche (§29-33) ;
// 7. transport inter-hub : GROUND 75 km/h (<500 km), FAST_GROUND 120 km/h
//    (500-1500 km), PLANE 750 km/h (>1500 km ou inter-région) (§34),
//    avec attente du prochain départ (fréquences §35) ;
// 8. distribution finale : max(distance / 65, 2 h) + 2-6 h déterministe (§36) ;
// 9. sauvegarder route + timeline complète + estimatedDeliveryAt.
//
// L'état courant est ensuite DÉRIVÉ de : timeline + heure actuelle (§44).

import type { GeoPoint } from './haversine.js'

export type PostTimelineStepType =
  | 'SENT'
  | 'COLLECTION'
  | 'LOCAL_TRANSPORT'
  | 'HUB_PROCESSING'
  | 'WAITING_DEPARTURE'
  | 'INTER_HUB_TRANSPORT'
  | 'FINAL_DELIVERY'
  | 'DELIVERED'

export interface PostTimelineStep {
  type: PostTimelineStepType
  hub?: string
  from?: string
  to?: string
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

export function calculatePostDelivery(
  _sender: GeoPoint,
  _receiver: GeoPoint,
  _messageId: string,
  _sentAt: number,
): PostDeliveryResult {
  throw new Error('Not implemented — voir docs/send method.txt §46 (POST)')
}
