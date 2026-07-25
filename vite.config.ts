import { defineConfig } from 'vite'

// GitHub Pages sert le jeu sous /let-them-bee/ ; itch.io le sert dans une iframe (base relative).
// `npm run build`      -> base '/let-them-bee/' (Pages)
// `npm run build:itch` -> base './' (itch, via --base=./)
export default defineConfig({
  base: '/let-them-bee/',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
})
