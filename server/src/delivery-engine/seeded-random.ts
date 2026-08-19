// TODO — Random déterministe seedé (docs/send method.txt §11, §40).
//
// RÈGLES :
// - JAMAIS Math.random() pour un calcul de voyage ;
// - toutes les variations sont dérivées du messageId ;
// - seeds dérivées par étape : `${messageId}:speed:1`, `${messageId}_HUB_EU_PAR`,
//   `${messageId}_COLLECTION`, `${messageId}_FINAL`, etc. ;
// - une même seed produit TOUJOURS la même valeur (hash FNV-1a suggéré §11).

/** Retourne une valeur déterministe dans [0, 1) pour une seed donnée. */
export function seededRandom(seed: string): number {
  let hash = 0x811c9dc5
  for (const char of seed) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) / 0x1_0000_0000
}

/** Valeur déterministe dans [min, max) pour une seed donnée. */
export function seededRandomBetween(
  seed: string,
  min: number,
  max: number,
): number {
  return min + (max - min) * seededRandom(seed)
}
