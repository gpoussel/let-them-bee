// Toutes les valeurs de tuning GAMEPLAY, centralisées pour un équilibrage rapide.
// Voir le GDD : section "Paramètres de gameplay".
// (Métadonnées/version -> config/game.ts ; couleurs/UI -> config/theme.ts.)

export const BEE = {
  maxSpeed: 320, // px/s
  // Lissage d'inertie : fraction de la distance rattrapée par seconde (converti par frame).
  // Plus petit = abeille plus "lourde". Elle traîne juste assez pour qu'un
  // virage serré se paie : viser une corolle au vol demande de l'anticipation,
  // sinon le trajet parfait serait une simple ligne brisée.
  lerp: 4.2,
  forageRadius: 28, // px
} as const

// La ruche. C'est ELLE qui a une contenance : la butineuse, sur un tour, porte
// ce qu'elle veut. Un plafond de sacoche se traduisait à l'écran par des fleurs
// survolées sans effet et sans explication — le stock, lui, est lisible en haut
// de l'écran, et se débloque dans l'arbre.
export const HIVE = {
  /** Réserve de nectar au premier lancement, avant toute amélioration. */
  nectarCapacity: 50,
} as const

// Cycle d'une fleur : elle pousse, s'ouvre, puis se fane et disparaît. Le nectar
// est MAXIMAL à l'instant où la corolle s'ouvre et décroît jusqu'à zéro : tout
// l'enjeu d'un trajet est d'arriver au bon moment, pas seulement de passer.
export const FLOWER = {
  /** Nombre d'emplacements dans le pré (une fleur y repousse indéfiniment). */
  count: 16,
  /** Nectar d'une corolle tout juste ouverte, avant le facteur d'espèce. */
  baseNectar: 2,
  /** Fraîcheur au-delà de laquelle la récolte est « Perfect ». */
  perfectFreshness: 0.85,
  perfectMultiplier: 2,
  /** Temps mort entre la disparition d'une fleur et la repousse suivante, en ms. */
  restMs: 2200,
  /** Graine du calendrier : le pré est identique d'une partie à l'autre. */
  seed: 1337,
} as const

/**
 * Une espèce de la planche Tiny Garden (l'index EST la colonne). Chacune a son
 * rythme : les plus voyantes sont les plus lentes à venir et les plus brèves,
 * mais elles paient beaucoup mieux. La couleur de la fleur annonce donc son
 * comportement — le joueur apprend le pré à l'œil.
 */
export interface FlowerKind {
  /** Durée de pousse, en ms (bouton fermé). */
  grow: number
  /** Durée de floraison avant disparition, en ms. */
  life: number
  /** Multiplicateur de nectar. */
  value: number
}

export const FLOWER_KINDS: readonly FlowerKind[] = [
  { grow: 9000, life: 4000, value: 3 }, // 0 rose
  { grow: 7000, life: 3500, value: 2.5 }, // 1 strélitzia
  { grow: 3500, life: 6000, value: 1 }, // 2 marguerite
  { grow: 6000, life: 5000, value: 2 }, // 3 tournesol
  { grow: 5000, life: 4500, value: 1.5 }, // 4 hortensia
  { grow: 7500, life: 3500, value: 2.5 }, // 5 jacinthe
  { grow: 10000, life: 3000, value: 3.5 }, // 6 orchidée
  { grow: 4000, life: 5500, value: 1.25 }, // 7 tulipe
] as const

// Trajet enregistré : l'itération unitaire du jeu. Le joueur pilote la butineuse
// une seule fois — de la ruche aux fleurs et retour — et ce tour est ensuite
// rejoué en boucle. Le pilotage n'est donc pas le jeu : c'est ce qu'on OPTIMISE.
export const ROUTE = {
  /** Période d'échantillonnage de la position, en ms (le pas du trajet). */
  sampleMs: 50,
  /**
   * Durée maximale d'un tour. C'est un couperet : à 10 s l'enregistrement
   * s'arrête, quoi que fasse le joueur. Le tour est court PARCE QU'il est
   * rejoué en boucle — dix secondes bien remplies valent mieux qu'une minute
   * de promenade.
   */
  maxDurationMs: 10000,
  /** Seuil à partir duquel le compteur passe au rouge : la fin approche. */
  warnMs: 8000,
  /** Durée minimale d'un tour retenu (évite d'enregistrer un aller-retour vide). */
  minDurationMs: 1500,
} as const

export const ECONOMY = {
  // 1 nectar déposé = 1 miel.
  royalJellyRate: 0.0005, // 0.05 % du miel gagné accumulé en gelée royale
  firstPrestigeThreshold: 1, // gelée royale min. pour prestige
  upgradeCostGrowth: 1.15,
} as const

/** Castes d'abeilles, DANS L'ORDRE DE DÉBLOCAGE (l'ordre fait foi). */
export type BeeKindId = 'forager' | 'worker' | 'warrior'

export interface BeeKind {
  id: BeeKindId
  /** Miel produit passivement, par individu et par seconde. */
  production: number
  /** Coût de la première recrue, en miel (croissance : `upgradeCostGrowth`). */
  cost: number
}

// La butineuse est l'abeille que l'on pilote : elle ne produit rien toute seule,
// c'est le joueur qui récolte. Les suivantes travaillent en fond.
export const BEE_KINDS: readonly BeeKind[] = [
  { id: 'forager', production: 0, cost: 0 },
  { id: 'worker', production: 0.5, cost: 50 },
  { id: 'warrior', production: 0, cost: 500 },
] as const
