import Phaser from 'phaser'
import { WORLD } from '../config/game'

// Transition d'écran « nid d'abeille » : une grille d'hexagones ambrés se
// referme sur l'écran depuis le centre, puis se rouvre sur la scène suivante.
// Utilisée dans les deux sens (titre → jeu et jeu → titre).

/** Clé de la texture d'hexagone bakée au boot. */
export const HEX_TEX = 'tex-hex-cell'

/** Largeur d'un hexagone (pointe gauche → pointe droite), en pixels. */
const HEX_W = 72
/** Hauteur d'un hexagone à plat (√3/2 × largeur). */
const HEX_H = HEX_W * 0.866
/** Couleurs de la cellule : miel et liseré brun olive (palette du jeu). */
const HEX_FILL = 0xf3b468
const HEX_EDGE = 0x71653f

/** Durée d'apparition/disparition d'une cellule. */
const CELL_MS = 260
/** Retard maximal ajouté aux cellules les plus éloignées du centre. */
const WAVE_MS = 440
/** Durée totale d'une demi-transition — sert à caler le fondu musical. */
export const TRANSITION_MS = CELL_MS + WAVE_MS

/** Profondeur du voile : au-dessus de tout le reste, HUD compris. */
const DEPTH = 100000

/** Sommets d'un hexagone pointe-à-gauche/droite, centrés sur (0,0). */
function hexPoints(w: number, h: number): Phaser.Math.Vector2[] {
  const q = w / 4
  return [
    [-w / 2, 0],
    [-q, -h / 2],
    [q, -h / 2],
    [w / 2, 0],
    [q, h / 2],
    [-q, h / 2],
  ].map(([x, y]) => new Phaser.Math.Vector2(x, y))
}

/** Bake la cellule hexagonale. À appeler une fois au boot. */
export function bakeHex(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false)
  // Centre de la texture : les sommets sont exprimés autour de (0,0).
  const offset = new Phaser.Math.Vector2(HEX_W / 2 + 1, HEX_H / 2 + 1)
  // Léger débord (+1px) pour que les cellules voisines se recouvrent et ne
  // laissent pas de liseré de fond une fois l'écran couvert.
  const pts = hexPoints(HEX_W + 2, HEX_H + 2).map((p) => p.add(offset))
  g.fillStyle(HEX_EDGE, 1)
  g.fillPoints(pts, true)
  const inner = hexPoints(HEX_W - 4, HEX_H - 4).map((p) => p.add(offset))
  g.fillStyle(HEX_FILL, 1)
  g.fillPoints(inner, true)
  g.generateTexture(HEX_TEX, HEX_W + 2, HEX_H + 2)
  g.destroy()
}

interface Cell {
  image: Phaser.GameObjects.Image
  /** Retard de la cellule dans la vague, en ms. */
  delay: number
}

/** Pose la grille d'hexagones couvrant l'écran, cellules à l'échelle `scale`. */
function buildGrid(scene: Phaser.Scene, scale: number): Cell[] {
  const { width, height } = WORLD
  const stepX = (HEX_W * 3) / 4
  const cx = width / 2
  const cy = height / 2
  const maxDist = Math.hypot(cx, cy)
  const cells: Cell[] = []

  for (let col = -1; col * stepX <= width + HEX_W; col++) {
    const x = col * stepX
    // Une colonne sur deux est décalée d'une demi-hauteur : c'est ce décalage
    // qui produit le pavage en nid d'abeille.
    const offset = col % 2 === 0 ? 0 : HEX_H / 2
    for (let row = -1; row * HEX_H + offset <= height + HEX_H; row++) {
      const y = row * HEX_H + offset
      const image = scene.add
        .image(x, y, HEX_TEX)
        .setScale(scale)
        .setDepth(DEPTH)
        .setScrollFactor(0)
      const dist = Math.hypot(x - cx, y - cy)
      cells.push({ image, delay: (dist / maxDist) * WAVE_MS })
    }
  }
  return cells
}

/**
 * Referme l'écran sous les hexagones puis appelle `onDone` (typiquement un
 * `scene.start`). Les entrées de la scène sont coupées pendant l'animation.
 */
export function transitionOut(scene: Phaser.Scene, onDone: () => void): void {
  scene.input.enabled = false
  const cells = buildGrid(scene, 0)
  let remaining = cells.length
  for (const cell of cells) {
    scene.tweens.add({
      targets: cell.image,
      scale: 1,
      duration: CELL_MS,
      delay: cell.delay,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (--remaining === 0) onDone()
      },
    })
  }
}

/**
 * Rouvre l'écran depuis le centre. À appeler en fin de `create()` de la scène
 * d'arrivée.
 */
export function transitionIn(scene: Phaser.Scene): void {
  scene.input.enabled = false
  const cells = buildGrid(scene, 1)
  let remaining = cells.length
  for (const cell of cells) {
    scene.tweens.add({
      targets: cell.image,
      scale: 0,
      duration: CELL_MS,
      delay: cell.delay,
      ease: 'Back.easeIn',
      onComplete: () => {
        cell.image.destroy()
        if (--remaining === 0) scene.input.enabled = true
      },
    })
  }
}
