// Injecté par Vite (cf. `define` dans vite.config.ts) depuis package.json.
declare const __APP_VERSION__: string

// Métadonnées du jeu. Point unique pour l'identité ; la version vient de package.json.
export const GAME = {
  version: __APP_VERSION__,
  name: 'Let Them Bee',
  saveKey: 'let-them-bee/save/v1',
  // Sauvegarde désactivée le temps de travailler l'écran d'accueil : chaque
  // lancement se présente comme celui d'un nouveau joueur.
  saveEnabled: false,
} as const

// Dimensions du monde / canvas.
export const WORLD = {
  width: 960,
  height: 540,
} as const
