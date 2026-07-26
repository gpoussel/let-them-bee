// Le RAYON : l'arbre d'améliorations, bâti alvéole par alvéole.
//
// Il n'y a pas de « nœud à trois niveaux » ici : chaque niveau EST une alvéole,
// posée contre la précédente. C'est ce qui fait du rayon une ruche qui s'étend
// plutôt qu'une liste de compteurs — on ne monte pas un niveau, on colle une
// cire de plus au bord du rayon. C'est aussi ce qui rend le dévoilement lisible :
// acheter une case ouvre ses voisines, et rien d'autre.
//
// Coordonnées AXIALES (q, r), hexagones POINTE EN HAUT :
//   x = R * sqrt(3) * (q + r/2)      y = R * 3/2 * r
// L'alvéole (0, 0) est la ruche elle-même : elle ne s'achète pas, et c'est
// d'elle que part le dévoilement.

/** Les quatre branches du rayon. Une branche = un effet, plusieurs alvéoles. */
export type UpgradeKind = 'storage' | 'foragers' | 'flight' | 'growth' | 'workers'

/** Monnaie d'une alvéole. Le rayon en accepte deux, et le dit par son icône. */
export type Currency = 'nectar' | 'honey'

export interface CombCell {
  /** Identifiant stable, persisté en sauvegarde (`storage-2`, `flight-1`…). */
  id: string
  kind: UpgradeKind
  /** Rang dans sa branche, à partir de 1. Sert au libellé (I, II, III, IV). */
  tier: number
  /** Prix, dans la monnaie ci-dessous. Une alvéole s'achète une fois, et pour de bon. */
  cost: number
  currency: Currency
  q: number
  r: number
}

/** Les six voisines d'une alvéole, en axial. */
export const NEIGHBORS: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
] as const

// Les branches partent de quatre voisines de la ruche, puis s'incurvent : trois
// rayons droits auraient fait une étoile, pas un rayon de miel. Le coude ramène
// les alvéoles les unes contre les autres.
//
// Tout le rayon se paie en NECTAR — celui que le joueur rapporte lui-même. Le
// miel reste la monnaie de la colonie (castes, prestige) : le rayon, lui, est
// l'affaire de la butineuse, et son prix se lit dans la seule ressource qu'un
// bon trajet fait monter. (`Currency` garde ses deux valeurs : le rayon sait
// afficher un prix en miel, il n'en pose simplement plus aucun.)
//
// Les prix sont calés sur la réserve : voir `UPGRADE_EFFECT.storageStep`.
export const COMB: readonly CombCell[] = [
  // Réserve — vers le haut.
  { id: 'storage-1', kind: 'storage', tier: 1, cost: 30, currency: 'nectar', q: 0, r: -1 },
  { id: 'storage-2', kind: 'storage', tier: 2, cost: 90, currency: 'nectar', q: 1, r: -2 },
  { id: 'storage-3', kind: 'storage', tier: 3, cost: 200, currency: 'nectar', q: 1, r: -3 },
  { id: 'storage-4', kind: 'storage', tier: 4, cost: 330, currency: 'nectar', q: 2, r: -4 },

  // Ouvrières — au bout de la branche « réserve », et nulle part ailleurs.
  //
  // 430, c'est la réserve pleine (450) à vingt nectar près : cette alvéole est
  // LA dernière chose que le nectar seul peut payer, et elle n'est même visible
  // qu'une fois les quatre paliers bâtis. Le jeu bascule là : jusqu'ici le
  // nectar servait à s'améliorer, à partir d'ici il se transforme (cf. `HONEY`).
  { id: 'workers-1', kind: 'workers', tier: 1, cost: 430, currency: 'nectar', q: 3, r: -5 },

  // Butineuses — une seule alvéole, à droite de la ruche.
  { id: 'foragers-1', kind: 'foragers', tier: 1, cost: 80, currency: 'nectar', q: 1, r: 0 },

  // Vol — vers le bas.
  { id: 'flight-1', kind: 'flight', tier: 1, cost: 40, currency: 'nectar', q: 0, r: 1 },
  { id: 'flight-2', kind: 'flight', tier: 2, cost: 110, currency: 'nectar', q: -1, r: 2 },
  { id: 'flight-3', kind: 'flight', tier: 3, cost: 240, currency: 'nectar', q: -1, r: 3 },
  { id: 'flight-4', kind: 'flight', tier: 4, cost: 400, currency: 'nectar', q: -2, r: 4 },

  // Pousse — vers la gauche.
  { id: 'growth-1', kind: 'growth', tier: 1, cost: 40, currency: 'nectar', q: -1, r: 0 },
  { id: 'growth-2', kind: 'growth', tier: 2, cost: 110, currency: 'nectar', q: -2, r: 0 },
  { id: 'growth-3', kind: 'growth', tier: 3, cost: 240, currency: 'nectar', q: -2, r: -1 },
  { id: 'growth-4', kind: 'growth', tier: 4, cost: 400, currency: 'nectar', q: -3, r: -1 },
] as const

/** Nombre d'alvéoles achetables au total (jauge du bouton d'accès). */
export const COMB_TOTAL = COMB.length

/**
 * Effet d'UN niveau de chaque branche.
 *
 * `storageStep` n'est pas un chiffre libre : c'est LUI qui décide si le rayon
 * est finissable. Tout s'y paie en nectar, or le nectar est PLAFONNÉ — une
 * alvéole plus chère que la réserve du moment est hors d'atteinte, le joueur
 * butine et la réserve sature avant le prix. Avec 100 par palier et quatre
 * alvéoles de réserve, le plafond monte 50 / 150 / 250 / 350 / 450 :
 *
 *   - la branche « réserve » reste toujours payable (30, puis 90 sous 150,
 *     200 sous 250, 330 sous 350) — c'est elle qui déverrouille tout le reste ;
 *   - les alvéoles de rang III (240) demandent deux paliers de réserve, celles
 *     de rang IV (400) les quatre. Ce n'est pas un cul-de-sac, c'est un ORDRE :
 *     on agrandit sa ruche avant de s'offrir le luxe.
 *
 * Toute nouvelle alvéole doit tenir sous 450, le plafond une fois la branche
 * « réserve » complète, sinon elle est inachetable pour toujours. C'est ce qui
 * cale l'alvéole « ouvrières » à 430 : le maximum qu'on puisse demander.
 */
export const UPGRADE_EFFECT = {
  storageStep: 100,
  /**
   * Gain de vitesse de vol par niveau. TRÈS léger, et c'est voulu : le pilotage
   * est ce que le joueur maîtrise, une amélioration qui le rendrait facile
   * viderait l'enregistrement de son intérêt.
   */
  flightStep: 0.04,
  /** Accélération du calendrier des fleurs par niveau. */
  growthStep: 0.08,
} as const

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'] as const

/** « II » pour la deuxième alvéole d'une branche ; rien si la branche est unique. */
export function tierLabel(cell: CombCell): string {
  const branch = COMB.filter((c) => c.kind === cell.kind)
  return branch.length > 1 ? ROMAN[cell.tier] : ''
}
