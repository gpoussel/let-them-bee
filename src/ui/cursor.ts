// Curseurs personnalisés (pixel art Cozyland UI, crédités dans la pop-up about).
//
// Les images sont importées comme modules : Vite réécrit l'URL au build, ce qui
// reste correct avec `--base=./` (build itch.io).
//
// Le curseur par défaut est posé une fois sur le canvas ; le curseur « main »
// est appliqué au survol des éléments explicitement marqués comme cliquables
// (cf. `handCursor`), pour ne pas l'attraper sur les zones qui ne servent qu'à
// absorber les clics (voile de modale, cadre de pop-up…).

import Phaser from 'phaser'
import arrowUrl from '../gfx/cursor-arrow.png'
import handUrl from '../gfx/cursor-hand.png'

// Hotspots (en pixels de l'image, images gravées ×2) : pointe de la flèche,
// bout de l'index. Le mot-clé final est le repli si l'image ne charge pas.
const ARROW = `url(${arrowUrl}) 2 0, default`
const HAND = `url(${handUrl}) 3 0, pointer`

// Zones de clic qui doivent afficher la main. On stocke l'objet Phaser porteur
// de la zone interactive ; le WeakSet évite toute rétention entre scènes.
const handTargets = new WeakSet<object>()

/** Pose le curseur par défaut du jeu. À appeler une fois au boot. */
export function installCursors(game: Phaser.Game): void {
  game.input.setDefaultCursor(ARROW)
  // Le canvas est centré en mode FIT : le fond de page reste visible autour.
  document.body.style.cursor = ARROW
}

/** Marque une zone de clic comme « lien » : curseur main au survol. */
export function handCursor(target: object): void {
  handTargets.add(target)
}

/**
 * Branche le suivi du survol sur une scène. Les listeners sont posés sur
 * l'InputPlugin de la scène, donc nettoyés avec elle.
 */
export function wireHandCursors(scene: Phaser.Scene): void {
  const canvas = scene.game.canvas
  const setHand = (_pointer: unknown, gameObject: Phaser.GameObjects.GameObject) => {
    if (handTargets.has(gameObject)) canvas.style.cursor = HAND
  }
  const reset = (_pointer: unknown, gameObject: Phaser.GameObjects.GameObject) => {
    if (handTargets.has(gameObject)) canvas.style.cursor = ARROW
  }
  scene.input.on(Phaser.Input.Events.GAMEOBJECT_OVER, setHand)
  scene.input.on(Phaser.Input.Events.GAMEOBJECT_OUT, reset)
  // Un changement de scène pendant un survol laisserait la main affichée.
  scene.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
    canvas.style.cursor = ARROW
  })
}
