// SKIN UI — couleurs, polices, tailles, layout des jauges et feedbacks.
// Entièrement découplé du moteur (src/config/*) : une autre version du jeu peut
// réutiliser le moteur avec un thème différent en remplaçant ce seul fichier.

export const COLORS = {
  cream: 0xfff6e0,
  honey: 0xf6c445,
  amber: 0xe89b2b,
  darkBrown: 0x3a2a1a,
  bgDark: 0x2b2233,
  grassA: 0x6fae5f,
  grassB: 0x7fb069,
  comboHigh: 0xf6c445,
  comboLow: 0xff6b3d,
  perfect: 0xffe08a,
} as const

// Versions hexadécimales string pour les textes / CSS.
export const HEX = {
  cream: '#fff6e0',
  honey: '#f6c445',
  jelly: '#ffd76a',
  perfect: '#ffe08a',
} as const

export const FONTS = {
  ui: 'monospace',
  sizeHoney: '22px',
  sizeJelly: '14px',
  sizeSmall: '12px',
  sizeCombo: '18px',
  sizePop: '16px',
  sizeTitle: '48px',
  sizeButton: '20px',
} as const

// Réglages d'affichage des jauges / feedbacks flottants.
export const HUD = {
  comboBarMax: 30, // valeur de combo qui remplit la jauge à 100 %
  nectarBarWidth: 124,
  comboBarWidth: 216,
  popRise: 34, // px de remontée du texte flottant
  popDuration: 700, // ms
} as const
