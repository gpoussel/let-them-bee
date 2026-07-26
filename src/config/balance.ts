// Toutes les valeurs de tuning GAMEPLAY, centralisées pour un équilibrage rapide.
// Le POURQUOI de ces valeurs est dans docs/GDD.md — à mettre à jour avec toute
// modification de gameplay (cf. CLAUDE.md).
// (Métadonnées/version -> config/game.ts ; couleurs/UI -> ui/theme.ts.)

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
//
// La contenance n'est plus un palier fixe multiplié par un niveau : elle suit une
// courbe QUADRATIQUE, et RAIDE. La branche « réserve » est courte (quinze
// alvéoles) : chacune doit donc peser. Un pas constant aurait fait de la
// quinzième un « +5 % » inaudible, alors qu'ici la dernière vaut à elle seule
// plus que les cinq premières.
export const HIVE = {
  /** Réserve de nectar au premier lancement, avant toute amélioration. */
  nectarBase: 100,
  /** Coefficient du terme carré : c'est lui qui fait décoller la courbe. */
  nectarQuad: 200,
  /** Coefficient du terme linéaire : il porte les premiers paliers. */
  nectarLinear: 100,
} as const

/**
 * Contenance de la réserve pour un niveau de réserve donné (= nombre d'alvéoles
 * « réserve » bâties).
 *
 * `100 + 200 n² + 100 n` : 100 / 400 / 1100 / 2200 / 3700 / 5600 / 7900…
 * jusqu'à 46 600 au quinzième et dernier palier.
 *
 * C'est LA fonction dont dépend la finissabilité du rayon : tout ce qui se paie
 * en nectar est borné par elle (cf. `storageCost` dans `config/upgrades`).
 */
export function getNectarCapacity(storageLevel: number): number {
  return HIVE.nectarBase + HIVE.nectarQuad * storageLevel ** 2 + HIVE.nectarLinear * storageLevel
}

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
  /**
   * Durée minimale d'un tour BREDOUILLE. Elle ne s'applique qu'aux tours sans
   * nectar : un tour qui rapporte compte quelle que soit sa durée (le critère
   * est le nectar par seconde), ce seuil n'est là que pour qu'un aller-retour
   * vide ne s'installe pas comme premier trajet de référence.
   */
  minDurationMs: 1500,
} as const

// La TRANSFORMATION. Le miel ne tombe plus du ciel : les ouvrières le tirent du
// nectar de la réserve, par LOTS. Un lot est une dépense franche (on voit la
// réserve tomber d'un coup), une attente visible (la jauge au-dessus de la
// ruche), puis un gain net. C'est ce qui donne enfin un débouché au nectar
// au-delà du rayon — et une raison de continuer à voler quand le rayon est bâti.
export const HONEY = {
  /**
   * Nectar consommé pour lancer un lot. Rien ne démarre en dessous : la
   * transformation attend, et repart d'elle-même dès que la réserve repasse le
   * seuil. Le montant est franc (près d'un sixième de la réserve au moment où
   * la première ouvrière arrive) pour que le joueur voie ce qu'il paie.
   */
  nectarPerBatch: 100,
  /** Durée d'un lot, en ms. C'est le temps que met la jauge à se remplir. */
  batchMs: 8000,
  /**
   * Miel rendu par un lot, PAR OUVRIÈRE. Volontairement minuscule devant les
   * 100 nectar dépensés : le miel n'est pas du nectar converti, c'est une
   * ressource d'un autre ordre, et son prix se compte en réserves entières.
   */
  honeyPerWorker: 0.25,
  /** Miel cumulé qui donne une dose de gelée royale (ci-dessous). */
  jellyThreshold: 50,
  jellyPerThreshold: 0.5,
} as const

export const ECONOMY = {
  firstPrestigeThreshold: 1, // gelée royale min. pour prestige
  upgradeCostGrowth: 1.15,
} as const

/** Castes d'abeilles, DANS L'ORDRE DE DÉBLOCAGE (l'ordre fait foi). */
export type BeeKindId = 'forager' | 'worker' | 'warrior'

export interface BeeKind {
  id: BeeKindId
  /** Coût de la première recrue, en miel (croissance : `upgradeCostGrowth`). */
  cost: number
}

// La butineuse est l'abeille que l'on pilote : elle ne produit rien toute seule,
// c'est le joueur qui récolte. L'ouvrière ne récolte rien non plus — elle
// TRANSFORME (cf. `HONEY`) : aucune caste ne fabrique de ressource à partir de
// rien, tout ce qui entre dans la ruche a été rapporté par un vol.
export const BEE_KINDS: readonly BeeKind[] = [
  { id: 'forager', cost: 0 },
  { id: 'worker', cost: 50 },
  { id: 'warrior', cost: 500 },
] as const
