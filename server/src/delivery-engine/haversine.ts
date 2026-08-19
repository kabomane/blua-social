// TODO — Distance Haversine entre deux points GPS (docs/send method.txt §03).
// Tous les calculs géographiques du réseau passent par cette fonction.

export interface GeoPoint {
  lat: number
  lon: number
}

/** Distance en kilomètres entre deux coordonnées GPS. */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const toRadians = (degrees: number) => degrees * Math.PI / 180
  const dLat = toRadians(b.lat - a.lat)
  const dLon = toRadians(b.lon - a.lon)
  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}
