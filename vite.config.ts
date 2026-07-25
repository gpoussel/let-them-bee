import { defineConfig } from 'vite'
import pkg from './package.json' with { type: 'json' }

// GitHub Pages sert le jeu sous /let-them-bee/ ; itch.io le sert dans une iframe (base relative).
// `npm run build`      -> base '/let-them-bee/' (Pages)
// `npm run build:itch` -> base './' (itch, via --base=./)
export default defineConfig({
  base: '/let-them-bee/',
  // Source unique de la version : package.json (affichée sur l'écran-titre).
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
})
