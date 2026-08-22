// ============================================================================
// DELIVERY_RULES — paramètres d'équilibrage centralisés.
// Source : docs/send method.txt (§43, §47) + docs/update pigeon speed.txt (§12)
//
// RÈGLE : ne jamais disperser ces valeurs dans le code. Pour équilibrer le
// gameplay, on modifie UNIQUEMENT ce fichier. Chaque delivery sauvegarde les
// résultats réellement calculés : changer les règles ne modifie jamais les
// voyages déjà partis.
// ============================================================================

export const DELIVERY_RULES = {
  bird: {
    // Vitesse : distribution triangulaire déterministe (2 tirages seedés,
    // seed = messageId) — voir update pigeon speed.txt
    minSpeedKmH: 40,
    targetSpeedKmH: 50,
    maxSpeedKmH: 60,
    speedDistribution: 'TRIANGULAR',
    speedRandomSamples: 2,
    speedPrecisionKmH: 0.1,

    routeFactor: 1.1,
    flightHoursPerDay: 12,
    restHoursPerDay: 12,
  },

  post: {
    collectionMinHours: 2,
    collectionMaxHours: 6,

    localSpeedKmH: 65,
    localMinHours: 2,

    normalHubProcessingMinHours: 5,
    normalHubProcessingMaxHours: 12,
    gatewayProcessingMinHours: 8,
    gatewayProcessingMaxHours: 16,

    finalDeliveryMinHours: 2,
    finalDeliveryMaxHours: 6,

    groundSpeedKmH: 75,
    fastGroundSpeedKmH: 120,
    planeSpeedKmH: 750,

    groundDepartureFrequencyHours: 4,
    fastGroundDepartureFrequencyHours: 6,
    regionalPlaneFrequencyHours: 8,
    internationalPlaneFrequencyHours: 12,

    // Horaires hub (heure locale du hub)
    weekdayOpenHour: 6,
    weekdayCloseHour: 22,
    saturdayOpenHour: 8,
    saturdayCloseHour: 16,
    saturdayEfficiency: 0.5, // 1 h de traitement = 2 h calendaires
    // Dimanche : fermé. Jours fériés (optionnel MVP) : comme un dimanche.
  },

  broadcast: {
    // Bornes mondiales conservatrices pour purger les bitmaps temporaires.
    birdMaxDays: 60,
    postMaxDays: 90,
  },
} as const

// Jours fériés par RÉGION (pas par pays) — optionnel pour le MVP.
export const HOLIDAYS: { date: string; region: string; name: string }[] = []
