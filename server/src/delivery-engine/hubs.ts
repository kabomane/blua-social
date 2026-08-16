// ============================================================================
// HUBS — réseau postal mondial simplifié.
// Source : docs/send method.txt (§18-§21)
//
// RÈGLES FONDAMENTALES :
// - exactement 40 hubs, 5 régions, 10 gateways (gateway: true) ;
// - l'utilisateur est assigné au hub le plus proche (Haversine), jamais à
//   une région directement ;
// - une liaison entre deux régions passe par des gateways ;
// - hub normal : traitement 5-12 h ; gateway : 8-16 h.
// ============================================================================

export type Region =
  | 'EUROPE'
  | 'AMERICAS'
  | 'AFRICA'
  | 'ASIA_PACIFIC'
  | 'MIDDLE_EAST'

export interface Hub {
  id: string
  city: string
  country: string
  region: Region
  lat: number
  lon: number
  timezone: string
  gateway: boolean
}

export const HUBS: Hub[] = [
  // -------------------------------------------------------------- EUROPE (8)
  { id: 'EU_PAR', city: 'Paris', country: 'France', region: 'EUROPE', lat: 48.8566, lon: 2.3522, timezone: 'Europe/Paris', gateway: true },
  { id: 'EU_LON', city: 'Londres', country: 'Royaume-Uni', region: 'EUROPE', lat: 51.5074, lon: -0.1278, timezone: 'Europe/London', gateway: true },
  { id: 'EU_AMS', city: 'Amsterdam', country: 'Pays-Bas', region: 'EUROPE', lat: 52.3676, lon: 4.9041, timezone: 'Europe/Amsterdam', gateway: false },
  { id: 'EU_MAD', city: 'Madrid', country: 'Espagne', region: 'EUROPE', lat: 40.4168, lon: -3.7038, timezone: 'Europe/Madrid', gateway: false },
  { id: 'EU_BER', city: 'Berlin', country: 'Allemagne', region: 'EUROPE', lat: 52.52, lon: 13.405, timezone: 'Europe/Berlin', gateway: false },
  { id: 'EU_ROM', city: 'Rome', country: 'Italie', region: 'EUROPE', lat: 41.9028, lon: 12.4964, timezone: 'Europe/Rome', gateway: false },
  { id: 'EU_WAW', city: 'Varsovie', country: 'Pologne', region: 'EUROPE', lat: 52.2297, lon: 21.0122, timezone: 'Europe/Warsaw', gateway: false },
  { id: 'EU_STO', city: 'Stockholm', country: 'Suède', region: 'EUROPE', lat: 59.3293, lon: 18.0686, timezone: 'Europe/Stockholm', gateway: false },

  // ------------------------------------------------------------ AMERICAS (9)
  { id: 'AM_YUL', city: 'Montréal', country: 'Canada', region: 'AMERICAS', lat: 45.5019, lon: -73.5674, timezone: 'America/Toronto', gateway: false },
  { id: 'AM_NYC', city: 'New York', country: 'États-Unis', region: 'AMERICAS', lat: 40.7128, lon: -74.006, timezone: 'America/New_York', gateway: true },
  { id: 'AM_CHI', city: 'Chicago', country: 'États-Unis', region: 'AMERICAS', lat: 41.8781, lon: -87.6298, timezone: 'America/Chicago', gateway: false },
  { id: 'AM_LAX', city: 'Los Angeles', country: 'États-Unis', region: 'AMERICAS', lat: 34.0522, lon: -118.2437, timezone: 'America/Los_Angeles', gateway: true },
  { id: 'AM_MEX', city: 'Mexico City', country: 'Mexique', region: 'AMERICAS', lat: 19.4326, lon: -99.1332, timezone: 'America/Mexico_City', gateway: false },
  { id: 'AM_BOG', city: 'Bogotá', country: 'Colombie', region: 'AMERICAS', lat: 4.711, lon: -74.0721, timezone: 'America/Bogota', gateway: false },
  { id: 'AM_LIM', city: 'Lima', country: 'Pérou', region: 'AMERICAS', lat: -12.0464, lon: -77.0428, timezone: 'America/Lima', gateway: false },
  { id: 'AM_SAO', city: 'São Paulo', country: 'Brésil', region: 'AMERICAS', lat: -23.5505, lon: -46.6333, timezone: 'America/Sao_Paulo', gateway: false },
  { id: 'AM_BUE', city: 'Buenos Aires', country: 'Argentine', region: 'AMERICAS', lat: -34.6037, lon: -58.3816, timezone: 'America/Argentina/Buenos_Aires', gateway: false },

  // -------------------------------------------------------------- AFRICA (7)
  { id: 'AF_CAS', city: 'Casablanca', country: 'Maroc', region: 'AFRICA', lat: 33.5731, lon: -7.5898, timezone: 'Africa/Casablanca', gateway: false },
  { id: 'AF_DKR', city: 'Dakar', country: 'Sénégal', region: 'AFRICA', lat: 14.7167, lon: -17.4677, timezone: 'Africa/Dakar', gateway: false },
  { id: 'AF_LOS', city: 'Lagos', country: 'Nigeria', region: 'AFRICA', lat: 6.5244, lon: 3.3792, timezone: 'Africa/Lagos', gateway: true },
  { id: 'AF_CAI', city: 'Le Caire', country: 'Égypte', region: 'AFRICA', lat: 30.0444, lon: 31.2357, timezone: 'Africa/Cairo', gateway: false },
  { id: 'AF_ADD', city: 'Addis-Abeba', country: 'Éthiopie', region: 'AFRICA', lat: 9.03, lon: 38.74, timezone: 'Africa/Addis_Ababa', gateway: false },
  { id: 'AF_NBO', city: 'Nairobi', country: 'Kenya', region: 'AFRICA', lat: -1.2921, lon: 36.8219, timezone: 'Africa/Nairobi', gateway: true },
  { id: 'AF_JNB', city: 'Johannesburg', country: 'Afrique du Sud', region: 'AFRICA', lat: -26.2041, lon: 28.0473, timezone: 'Africa/Johannesburg', gateway: false },

  // -------------------------------------------------------- ASIA_PACIFIC (10)
  { id: 'AS_TYO', city: 'Tokyo', country: 'Japon', region: 'ASIA_PACIFIC', lat: 35.6762, lon: 139.6503, timezone: 'Asia/Tokyo', gateway: true },
  { id: 'AS_SEL', city: 'Séoul', country: 'Corée du Sud', region: 'ASIA_PACIFIC', lat: 37.5665, lon: 126.978, timezone: 'Asia/Seoul', gateway: false },
  { id: 'AS_BJS', city: 'Pékin', country: 'Chine', region: 'ASIA_PACIFIC', lat: 39.9042, lon: 116.4074, timezone: 'Asia/Shanghai', gateway: false },
  { id: 'AS_SHA', city: 'Shanghai', country: 'Chine', region: 'ASIA_PACIFIC', lat: 31.2304, lon: 121.4737, timezone: 'Asia/Shanghai', gateway: false },
  { id: 'AS_DEL', city: 'New Delhi', country: 'Inde', region: 'ASIA_PACIFIC', lat: 28.6139, lon: 77.209, timezone: 'Asia/Kolkata', gateway: false },
  { id: 'AS_BOM', city: 'Mumbai', country: 'Inde', region: 'ASIA_PACIFIC', lat: 19.076, lon: 72.8777, timezone: 'Asia/Kolkata', gateway: false },
  { id: 'AS_BKK', city: 'Bangkok', country: 'Thaïlande', region: 'ASIA_PACIFIC', lat: 13.7563, lon: 100.5018, timezone: 'Asia/Bangkok', gateway: false },
  { id: 'AS_SIN', city: 'Singapour', country: 'Singapour', region: 'ASIA_PACIFIC', lat: 1.3521, lon: 103.8198, timezone: 'Asia/Singapore', gateway: true },
  { id: 'AS_JKT', city: 'Jakarta', country: 'Indonésie', region: 'ASIA_PACIFIC', lat: -6.2088, lon: 106.8456, timezone: 'Asia/Jakarta', gateway: false },
  { id: 'AS_SYD', city: 'Sydney', country: 'Australie', region: 'ASIA_PACIFIC', lat: -33.8688, lon: 151.2093, timezone: 'Australia/Sydney', gateway: false },

  // --------------------------------------------------------- MIDDLE_EAST (6)
  { id: 'ME_IST', city: 'Istanbul', country: 'Turquie', region: 'MIDDLE_EAST', lat: 41.0082, lon: 28.9784, timezone: 'Europe/Istanbul', gateway: true },
  { id: 'ME_THR', city: 'Téhéran', country: 'Iran', region: 'MIDDLE_EAST', lat: 35.6892, lon: 51.389, timezone: 'Asia/Tehran', gateway: false },
  { id: 'ME_BGW', city: 'Bagdad', country: 'Irak', region: 'MIDDLE_EAST', lat: 33.3152, lon: 44.3661, timezone: 'Asia/Baghdad', gateway: false },
  { id: 'ME_RUH', city: 'Riyad', country: 'Arabie saoudite', region: 'MIDDLE_EAST', lat: 24.7136, lon: 46.6753, timezone: 'Asia/Riyadh', gateway: false },
  { id: 'ME_DXB', city: 'Dubaï', country: 'Émirats arabes unis', region: 'MIDDLE_EAST', lat: 25.2048, lon: 55.2708, timezone: 'Asia/Dubai', gateway: true },
  { id: 'ME_DOH', city: 'Doha', country: 'Qatar', region: 'MIDDLE_EAST', lat: 25.2854, lon: 51.531, timezone: 'Asia/Qatar', gateway: false },
]

export const GATEWAYS: Hub[] = HUBS.filter((h) => h.gateway)
