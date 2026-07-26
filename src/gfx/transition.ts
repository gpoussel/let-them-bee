import Phaser from 'phaser'
import { WORLD } from '../config/game'

// Transition d'écran « nid d'abeille » : une grille d'hexagones ambrés se
// referme sur l'écran depuis le centre, puis se rouvre sur la scène suivante.
// Utilisée dans les deux sens (titre → jeu et jeu → titre).

/** Clés des textures d'hexagone bakées au boot (variantes de moucheture). */
export const HEX_TEX = ['tex-hex-cell-0', 'tex-hex-cell-1', 'tex-hex-cell-2'] as const

/** Largeur d'un hexagone (pointe gauche → pointe droite), en pixels. */
const HEX_W = 72
/** Hauteur d'un hexagone à plat (√3/2 × largeur). */
const HEX_H = HEX_W * 0.866
/** Couleurs de la cellule (palette du jeu, cf. CLAUDE.md) : miel pour la cire,
 * brun olive pour le liseré et l'ombre, jaune-vert clair pour la lumière. */
const HEX_FILL = 0xf3b468
const HEX_EDGE = 0x71653f
const HEX_LIGHT = 0xd6dc53

/** Décalage du remplissage vers le bas-droite : c'est lui qui crée le biseau —
 * un liseré clair en haut-gauche, une ombre épaissie en bas-droite. */
const BEVEL_X = 2
const BEVEL_Y = 2
/** Nombre de mouchetures par variante et taille d'une moucheture (en px). */
const SPECKS = 8
const SPECK = 2

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

/** Vrai si (x, y) est dans un hexagone pointe-à-gauche/droite centré sur (0,0). */
function insideHex(x: number, y: number, w: number, h: number): boolean {
  const ax = Math.abs(x)
  const ay = Math.abs(y)
  if (ax > w / 2 || ay > h / 2) return false
  if (ax <= w / 4) return true
  // Sur les biseaux gauche/droite, la hauteur autorisée décroît linéairement.
  return ay <= (h / 2) * ((w / 2 - ax) / (w / 4))
}

/** Générateur pseudo-aléatoire déterministe : la moucheture d'une variante ne
 * change pas d'une partie à l'autre. */
function seeded(seed: number): () => number {
  let s = seed * 2654435761 + 1
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/**
 * Bake les variantes de cellule hexagonale. À appeler une fois au boot.
 *
 * Chaque cellule est construite en trois passes : le liseré brun olive, un
 * hexagone clair, puis le miel décalé vers le bas-droite — ce décalage laisse
 * apparaître le clair en haut-gauche et épaissit l'ombre en bas-droite, ce qui
 * donne le relief. Quelques mouchetures achèvent de casser l'aplat.
 */
export function bakeHex(scene: Phaser.Scene): void {
  // Centre de la texture : les sommets sont exprimés autour de (0,0).
  const offset = new Phaser.Math.Vector2(HEX_W / 2 + 1, HEX_H / 2 + 1)
  // Léger débord (+1px) pour que les cellules voisines se recouvrent et ne
  // laissent pas de liseré de fond une fois l'écran couvert.
  const edge = hexPoints(HEX_W + 2, HEX_H + 2).map((p) => p.add(offset))
  const light = hexPoints(HEX_W - 4, HEX_H - 4).map((p) => p.add(offset))
  // Le miel est rétréci de 2× le biseau puis décalé de 1× : il affleure le bord
  // bas-droite de l'hexagone clair et s'en écarte d'autant en haut-gauche.
  const fillW = HEX_W - 4 - 2 * BEVEL_X
  const fillH = HEX_H - 4 - 2 * BEVEL_Y
  const fillCenter = offset.clone().add(new Phaser.Math.Vector2(BEVEL_X, BEVEL_Y))
  const fill = hexPoints(fillW, fillH).map((p) => p.add(fillCenter))

  HEX_TEX.forEach((key, variant) => {
    const g = scene.make.graphics({ x: 0, y: 0 }, false)
    g.fillStyle(HEX_EDGE, 1)
    g.fillPoints(edge, true)
    g.fillStyle(HEX_LIGHT, 1)
    g.fillPoints(light, true)
    g.fillStyle(HEX_FILL, 1)
    g.fillPoints(fill, true)

    // Mouchetures : alternance clair / ombre posée dans la cire, en restant à
    // l'intérieur de l'hexagone de miel pour ne pas manger le biseau.
    const rnd = seeded(variant + 1)
    for (let i = 0; i < SPECKS; i++) {
      const dx = (rnd() - 0.5) * fillW
      const dy = (rnd() - 0.5) * fillH
      if (!insideHex(dx, dy, fillW - SPECK * 4, fillH - SPECK * 4)) continue
      g.fillStyle(i % 2 === 0 ? HEX_LIGHT : HEX_EDGE, 1)
      g.fillRect(
        Math.round(fillCenter.x + dx),
        Math.round(fillCenter.y + dy),
        SPECK,
        i % 2 === 0 ? SPECK : SPECK - 1,
      )
    }

    g.generateTexture(key, HEX_W + 2, HEX_H + 2)
    g.destroy()
  })
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
      // Variante de moucheture choisie sur la position : deux cellules voisines
      // ne portent pas le même grain, mais une cellule garde le sien.
      const image = scene.add
        .image(x, y, HEX_TEX[Math.abs(col * 7 + row * 3) % HEX_TEX.length])
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
