// TODO — Distance Haversine entre deux points GPS (docs/send method.txt §03).
// Tous les calculs géographiques du réseau passent par cette fonction.

export interface GeoPoint {
  lat: number
  lon: number
}

/** Distance en kilomètres entre deux coordonnées GPS. */
export function distanceKm(_a: GeoPoint, _b: GeoPoint): number {
  throw new Error('Not implemented — voir docs/send method.txt §03')
}
