// Métadonnées du jeu. Point unique pour la version et l'identité.
export const GAME = {
  version: '0.1.0',
  name: 'Let Them Bee',
  saveKey: 'let-them-bee/save/v1',
} as const

// Dimensions du monde / canvas.
export const WORLD = {
  width: 960,
  height: 540,
} as const
