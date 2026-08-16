// TODO — Random déterministe seedé (docs/send method.txt §11, §40).
//
// RÈGLES :
// - JAMAIS Math.random() pour un calcul de voyage ;
// - toutes les variations sont dérivées du messageId ;
// - seeds dérivées par étape : `${messageId}:speed:1`, `${messageId}_HUB_EU_PAR`,
//   `${messageId}_COLLECTION`, `${messageId}_FINAL`, etc. ;
// - une même seed produit TOUJOURS la même valeur (hash FNV-1a suggéré §11).

/** Retourne une valeur déterministe dans [0, 1) pour une seed donnée. */
export function seededRandom(_seed: string): number {
  throw new Error('Not implemented — voir docs/send method.txt §11')
}

/** Valeur déterministe dans [min, max) pour une seed donnée. */
export function seededRandomBetween(
  _seed: string,
  _min: number,
  _max: number,
): number {
  throw new Error('Not implemented — voir docs/send method.txt §11 et §40')
}
