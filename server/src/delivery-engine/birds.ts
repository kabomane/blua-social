// ============================================================================
// BIRDS — espèces d'oiseaux disponibles.
// Source : docs/send method.txt (§06) + docs/update pigeon speed.txt
// MVP : un seul oiseau, le rouge-gorge (ROBIN).
// ============================================================================

export interface Bird {
  id: string
  name: string
  /** Vitesse min/cible/max en km/h — distribution triangulaire déterministe */
  minSpeedKmH: number
  targetSpeedKmH: number
  maxSpeedKmH: number
  flightHoursPerDay: number
  restHoursPerDay: number
  routeFactor: number
}

export const ROBIN: Bird = {
  id: 'ROBIN',
  name: 'Rouge-gorge',
  minSpeedKmH: 40,
  targetSpeedKmH: 50,
  maxSpeedKmH: 60,
  flightHoursPerDay: 8,
  restHoursPerDay: 16,
  routeFactor: 1.1,
}

export const BIRDS: Record<string, Bird> = {
  ROBIN,
}
