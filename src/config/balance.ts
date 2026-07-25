// Toutes les valeurs de tuning GAMEPLAY, centralisées pour un équilibrage rapide.
// Voir le GDD : section "Paramètres de gameplay".
// (Métadonnées/version -> config/game.ts ; couleurs/UI -> config/theme.ts.)

export const BEE = {
  maxSpeed: 380, // px/s
  // Lissage d'inertie : fraction de la distance rattrapée par seconde (converti par frame).
  // Plus petit = abeille plus "lourde".
  lerp: 6.5,
  forageRadius: 28, // px
  nectarCapacity: 20,
} as const

export const FLOWER = {
  baseNectar: 1,
  perfectMultiplier: 2,
  perfectWindow: 0.25, // fraction du cycle où le butinage est "Perfect"
  openCycle: 2.5, // s, ouverture/fermeture en boucle
  rechargeCooldown: 4, // s avant de pouvoir re-butiner la même fleur
  count: 14, // nombre de fleurs dans le champ
} as const

export const COMBO = {
  perFlower: 1,
  perPerfect: 2,
  multiplierPerPoint: 0.05, // mult = 1 + combo * 0.05
  decayDelay: 2.0, // s sans butinage avant décroissance
  decayInterval: 0.4, // s entre chaque -1
} as const

export const ECONOMY = {
  // 1 nectar déposé = 1 miel, multiplié par le combo courant au moment du dépôt.
  royalJellyRate: 0.0005, // 0.05 % du miel gagné accumulé en gelée royale
  firstPrestigeThreshold: 1, // gelée royale min. pour prestige
  upgradeCostGrowth: 1.15,
  workerProduction: 0.5, // miel/s par ouvrière
} as const
