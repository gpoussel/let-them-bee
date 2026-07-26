// SKIN UI — couleurs, polices, tailles, layout des jauges et feedbacks.
// Entièrement découplé du moteur (src/config/*) : une autre version du jeu peut
// réutiliser le moteur avec un thème différent en remplaçant ce seul fichier.

// Palette officielle du jeu (cf. CLAUDE.md). Toute couleur POSÉE À PARTIR D'ICI
// doit en être tirée ; les entrées historiques de COLORS sont encore hors
// palette et restent à migrer (cf. PROGRESS.md).
export const PALETTE = {
  oliveBrown: 0x71653f,
  lime: 0xd6dc53,
  amber: 0xf3b468,
  meadow: 0x639b35,
  darkGreen: 0x4a655a,
} as const

export const COLORS = {
  cream: 0xfff6e0,
  honey: 0xf6c445,
  amber: 0xe89b2b,
  // Palette du jeu (cf. CLAUDE.md) : ambre clair et vert-gris sombre, les deux
  // teintes qui restent lisibles sur le gazon.
  amberSoft: 0xf3b468,
  deepGreen: 0x4a655a,
  darkBrown: 0x3a2a1a,
  bgDark: 0x2b2233,
  grassA: 0x6fae5f,
  grassB: 0x7fb069,
  // Le seul rouge du jeu, et il ne sert qu'à une chose : le compte à rebours
  // d'un enregistrement dans ses deux dernières secondes. Hors palette à
  // dessein — c'est une alarme, elle doit jurer.
  alert: 0xff6b3d,
  perfect: 0xffe08a,
  jelly: 0xffd76a,
} as const

// Versions hexadécimales string pour les textes / CSS.
export const HEX = {
  cream: '#fff6e0',
  honey: '#f6c445',
  jelly: '#ffd76a',
  perfect: '#ffe08a',
  alert: '#ff6b3d',
} as const

// Tailles de la bitmap font « monogram » (cf. src/gfx/font.ts). La cellule native
// fait 12px : on n'utilise QUE des multiples de 12 pour garantir un scaling entier
// (nearest-neighbor) et donc un rendu pixel-perfect, sans anti-aliasing.
export const FONTS = {
  sizeHoney: 36,
  sizeJelly: 24,
  sizeSmall: 24,
  /** Compteur d'enregistrement : il doit se lire sans quitter le pré des yeux. */
  sizeTimer: 36,
  sizePop: 24,
  sizeTitle: 48,
  sizeButton: 24,
  sizeHint: 12,
} as const

// Découpe de l'écran de jeu, en coordonnées absolues du monde (960x540, scale
// FIT : le layout n'a pas à être responsive). Le pré carré du mini-jeu est
// volontairement minoritaire — l'essentiel de l'écran appartient à la ruche.
export const SCREEN = {
  bar: { x: 10, y: 10, w: 940, h: 42 },
  colony: { x: 10, y: 60, w: 210, h: 378 },
  /** Accès à l'arbre d'améliorations : un simple bouton, pas un panneau. */
  tree: { x: 10, y: 446, w: 210, h: 84 },
  field: { x: 232, y: 60, w: 718, h: 378 },
  // Le bandeau du pré a été ramené au strict nécessaire (message, bilan du
  // meilleur tour, bouton) : chaque pixel qu'il rend est un pixel de PRÉ, et
  // c'est le pré qui est le jeu.
  status: { x: 232, y: 446, w: 718, h: 84 },
} as const

/** Marge intérieure entre le bord d'un cadre nine-slice et son contenu. */
export const PANEL_PAD = 14

// Habillage des cadres. La tuile brune du tileset est franchement orangée : posée
// en grand et en aplat sur du gazon, elle sature l'écran. On la rabat donc vers
// le vert-gris sombre de la palette — un fond calme, qui laisse les textes crème
// et ambre porter seuls la couleur. Les infobulles, elles, gardent la tuile nue :
// il FAUT qu'elles tranchent sur le cadre qu'elles recouvrent.
export const PANEL_TINT = PALETTE.darkGreen

/** Teinte de l'icône de chaque caste (clés : `BeeKindId`). */
export const BEE_TINT: Record<string, number> = {
  forager: PALETTE.amber,
  worker: PALETTE.lime,
  warrior: PALETTE.meadow,
}

// Réglages d'affichage des jauges / feedbacks flottants.
export const HUD = {
  nectarBarWidth: 124,
  popRise: 34, // px de remontée du texte flottant
  popDuration: 700, // ms
  /**
   * Durée d'un VERDICT dans le bandeau (« New best run! », « Time's up »).
   * Il s'efface ensuite au profit de la consigne permanente : un verdict qui
   * reste à l'écran cesse d'être une nouvelle et devient un décor, et le joueur
   * ne sait plus s'il parle du dernier tour ou de l'avant-dernier.
   */
  verdictMs: 3500,
} as const

// Flèche de relance (cf. ui/Nudge).
export const NUDGE = {
  /** Au-dessus des cadres, sous les textes flottants du jeu. */
  depth: 290,
  bob: 8, // amplitude du va-et-vient, en px
  bobMs: 620,
} as const
