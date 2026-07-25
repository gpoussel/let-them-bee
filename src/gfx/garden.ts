import Phaser from 'phaser'
import { TEX } from './textures'

// Jardin : décor de fond composé à partir du pack « Tiny Garden ».
//
// Le rendu est « bakè » une fois dans une texture canvas (une seule image à
// l'écran, aucun coût par frame) à partir de deux planches 16x16 :
//   - `tileset.png` : gazon, terre, eau, touffes et buissons ;
//   - `objects.png` : les fleurs, 9 espèces x 4 stades de pousse.
//
// Composition voulue : une grande étendue de gazon presque unie au centre —
// c'est là que vit l'interface — encadrée par des parterres bien alignés et un
// bassin. Chaque parterre montre une espèce à des stades croissants de gauche
// à droite.

/** Côté d'une tuile, en pixels. */
export const TILE = 16

// --- Repères dans `tileset.png` (23x6 tuiles) --------------------------------

/** Vert du gazon, identique à la tuile pleine du tileset. */
export const GRASS = '#43a354'
/** Touffes d'herbe éparses. */
const TUFTS: Array<[number, number]> = [
  [0, 5],
  [1, 5],
  [2, 5],
]
/** Cailloux et buissons, posés à l'unité. */
const SCRUB: Array<[number, number]> = [
  [11, 5],
  [12, 5],
  [13, 5],
  [14, 5],
  [15, 5],
]
// Bande de terre haute d'une tuile : extrémité gauche, deux motifs de milieu,
// extrémité droite (tous sur la ligne 0 du tileset).
const BED_ROW = 0
const BED_LEFT = 2
const BED_MID: [number, number] = [3, 4]
const BED_RIGHT = 5
// Bassin : bloc de 4x4 tuiles (colonnes gauche / milieu x2 / droite, lignes
// berge / eau x2 / rive basse).
const POND_COL: [number, number, number, number] = [9, 10, 11, 12]
const POND_ROW: [number, number, number, number] = [1, 2, 3, 4]

// --- Repères dans `objects.png` (9x8 tuiles) ---------------------------------

/** Nombre d'espèces plantables (la dernière, le lotus, ne pousse que sur l'eau). */
const SPECIES = 8
const LOTUS = 8
/** Stades de pousse : [ligne dans la planche, hauteur en tuiles]. */
const STAGES: Array<[number, number]> = [
  [2, 1], // graine
  [3, 1], // pousse
  [4, 2], // bouton
  [6, 2], // floraison
]

/** Densité de touffes d'herbe (proportion de tuiles). */
const TUFT_DENSITY = 0.07

export interface GardenOpts {
  /** Nom de la texture produite. */
  key: string
  /** Dimensions en tuiles. */
  cols: number
  rows: number
  /** Graine du tirage (le décor est identique d'une exécution à l'autre). */
  seed?: number
}

/** Générateur pseudo-aléatoire déterministe (LCG), pour un décor reproductible. */
function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

type SourceImage = HTMLImageElement | HTMLCanvasElement

function sourceImage(scene: Phaser.Scene, key: string): SourceImage {
  return scene.textures.get(key).getSourceImage() as SourceImage
}

/**
 * Compose le jardin dans une texture canvas. À appeler une fois au boot, après
 * le chargement des deux planches. Le décor est déterministe : deux appels avec
 * la même graine donnent exactement la même image.
 */
export function bakeGarden(scene: Phaser.Scene, o: GardenOpts): void {
  const { key, cols, rows } = o
  const width = cols * TILE
  const height = rows * TILE

  if (scene.textures.exists(key)) scene.textures.remove(key)
  const texture = scene.textures.createCanvas(key, width, height)
  if (!texture) throw new Error(`garden: création de la texture ${key} impossible`)
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST)
  const ctx = texture.context

  const tiles = sourceImage(scene, TEX.tileset)
  const objects = sourceImage(scene, TEX.objects)
  /** Colle une tuile (ou un bloc de tuiles) de `sheet` aux coordonnées tuile. */
  const blit = (
    sheet: SourceImage,
    col: number,
    row: number,
    tx: number,
    ty: number,
    w = 1,
    h = 1,
  ): void => {
    ctx.drawImage(
      sheet,
      col * TILE,
      row * TILE,
      w * TILE,
      h * TILE,
      tx * TILE,
      ty * TILE,
      w * TILE,
      h * TILE,
    )
  }

  // 1. Gazon : un aplat, puis des touffes éparses pour texturer sans bruit.
  ctx.fillStyle = GRASS
  ctx.fillRect(0, 0, width, height)
  const rnd = random(o.seed ?? 7)
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      if (rnd() >= TUFT_DENSITY) continue
      const [col, row] = TUFTS[Math.floor(rnd() * TUFTS.length)]
      blit(tiles, col, row, tx, ty)
    }
  }

  // 2. Bassin, en bas à gauche, avec quelques nénuphars.
  const pond = { x: 3, y: rows - 9, w: 16, h: 6 }
  for (let j = 0; j < pond.h; j++) {
    const row = j === 0 ? POND_ROW[0] : j === pond.h - 1 ? POND_ROW[3] : POND_ROW[1 + (j % 2)]
    for (let i = 0; i < pond.w; i++) {
      const col = i === 0 ? POND_COL[0] : i === pond.w - 1 ? POND_COL[3] : POND_COL[1 + (i % 2)]
      blit(tiles, col, row, pond.x + i, pond.y + j)
    }
  }
  // Les nénuphars restent sur l'eau : jamais sur la berge (j = 0) ni sur la
  // rive basse (dernière ligne).
  for (const [dx, dy] of [
    [3, 2],
    [8, 4],
    [12, 2],
    [6, 3],
  ]) {
    blit(objects, LOTUS, STAGES[3][0], pond.x + dx, pond.y + dy - 1, 1, 2)
  }

  // 3. Parterres : deux colonnes le long des bords, plus une série en bas à
  //    droite. Le centre de l'écran reste du gazon nu.
  const beds: Array<[number, number, number]> = []
  const sideRows = [3, 6, 9, 12, 15, 18, 21]
  sideRows.forEach((y, k) => {
    beds.push([2, y, k % SPECIES])
    beds.push([cols - 10, y, (k + 4) % SPECIES])
  })
  ;[rows - 9, rows - 6, rows - 3].forEach((y, k) => {
    beds.push([cols - 18, y, (k + 2) % SPECIES])
  })

  const BED_LEN = 8
  for (const [bx, by, species] of beds) {
    for (let i = 0; i < BED_LEN; i++) {
      const col =
        i === 0 ? BED_LEFT : i === BED_LEN - 1 ? BED_RIGHT : BED_MID[i % BED_MID.length]
      blit(tiles, col, BED_ROW, bx + i, by)
    }
    // Stades croissants de gauche à droite : le parterre se lit comme une
    // frise de la graine à la fleur.
    for (let i = 0; i < BED_LEN; i++) {
      const [row, h] = STAGES[Math.min(STAGES.length - 1, Math.floor((i * STAGES.length) / BED_LEN))]
      blit(objects, species, row, bx + i, by - (h - 1), 1, h)
    }
  }

  // 4. Quelques cailloux et buissons pour casser l'uniformité du gazon.
  for (const [tx, ty, i] of [
    [20, 4, 3],
    [21, 20, 4],
    [35, 8, 3],
    [46, 14, 4],
    [24, 15, 0],
    [38, 22, 1],
    [30, 3, 2],
    [15, 20, 3],
    [cols - 4, rows - 9, 4],
    [cols - 4, rows - 5, 3],
  ]) {
    const [col, row] = SCRUB[i]
    blit(tiles, col, row, tx, ty)
  }

  texture.refresh()
}
