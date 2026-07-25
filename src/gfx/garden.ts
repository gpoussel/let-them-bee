import Phaser from 'phaser'
import { TEX } from './textures'

// Jardin : décor de fond composé à partir du pack « Tiny Garden ».
//
// Le rendu est « bakè » une fois dans une texture canvas (une seule image à
// l'écran, aucun coût par frame) à partir de deux planches 16x16 :
//   - `tileset.png` : gazon, terre, eau, touffes, buissons, arbre et maison ;
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
/** Arbre : bloc de 2x3 tuiles, posé par sa base. */
const TREE = { col: 17, row: 0, w: 2, h: 3 } as const
/** Maisonnette : bloc de 3x3 tuiles, posé par son coin haut-gauche. */
const HOUSE = { col: 17, row: 3, w: 3, h: 3 } as const
/** Buisson planté au pied gauche de la maison. */
const HOUSE_BUSH: [number, number] = [15, 5]
/** Touffes d'herbe au pied droit, décalées en tuiles depuis le coin. */
const HOUSE_TUFTS: Array<[number, number]> = [
  [0, 0],
  [0, -1],
]
/** Cailloux et buissons, posés à l'unité. */
const SCRUB: Array<[number, number]> = [
  [11, 5],
  [12, 5],
  [13, 5],
  [14, 5],
  [15, 5],
]
// Bloc de terre : colonnes bord gauche / deux motifs de milieu / bord droit,
// lignes bord haut / deux motifs de milieu / bord bas.
const BED_COL: [number, number, number, number] = [2, 3, 4, 5]
const BED_ROW: [number, number, number, number] = [1, 2, 3, 4]
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
const TUFT_DENSITY = 0.22
/** Nombre de buissons et cailloux dispersés sur le gazon. */
const SCRUB_COUNT = 34

/** Parterres : emprise maximale et espacement vertical, en tuiles. */
const BED_W = 12
const BED_H = 7
const BED_GAP = 3
/** Retrait maximal des bords : donne au parterre une forme libre, pas un rectangle. */
const BED_INSET = 2
/** Proportion de trous dans un parterre (une terre jamais parfaitement pleine). */
const BED_HOLE = 0.08
/** Proportion de pieds de la seconde variété plantée dans un parterre. */
const BED_COMPANION = 0.3
/** Probabilité qu'un arbre pousse devant un parterre. */
const TREE_CHANCE = 0.5

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

  // Tuiles déjà prises (terre, eau) : le gazon et ses décors les évitent.
  const busy = new Uint8Array(cols * rows)
  const take = (tx: number, ty: number): void => {
    if (tx >= 0 && tx < cols && ty >= 0 && ty < rows) busy[ty * cols + tx] = 1
  }
  const free = (tx: number, ty: number): boolean =>
    tx >= 0 && tx < cols && ty >= 0 && ty < rows && busy[ty * cols + tx] === 0

  // 1. Gazon : un aplat, puis des touffes pour texturer sans bruit.
  ctx.fillStyle = GRASS
  ctx.fillRect(0, 0, width, height)
  const rnd = random(o.seed ?? 7)
  const tufts: Array<[number, number]> = []
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      if (rnd() < TUFT_DENSITY) tufts.push([tx, ty])
    }
  }

  // 2. Bassin, en bas à gauche, avec quelques nénuphars.
  const pond = { x: 3, y: rows - 9, w: 16, h: 6 }
  for (let j = 0; j < pond.h; j++) {
    const row = j === 0 ? POND_ROW[0] : j === pond.h - 1 ? POND_ROW[3] : POND_ROW[1 + (j % 2)]
    for (let i = 0; i < pond.w; i++) {
      const col = i === 0 ? POND_COL[0] : i === pond.w - 1 ? POND_COL[3] : POND_COL[1 + (i % 2)]
      blit(tiles, col, row, pond.x + i, pond.y + j)
      take(pond.x + i, pond.y + j)
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

  // 3. La maisonnette du jardinier, sur la berge du bassin. Elle est réservée
  //    dans `busy` : ni buisson ni touffe ne viendra la parasiter.
  const house = { x: pond.x + pond.w + 2, y: pond.y + 2 }
  blit(tiles, HOUSE.col, HOUSE.row, house.x, house.y, HOUSE.w, HOUSE.h)
  for (let j = 0; j < HOUSE.h; j++) {
    for (let i = 0; i < HOUSE.w; i++) take(house.x + i, house.y + j)
  }
  // Un buisson d'un côté, deux touffes de l'autre : la maison est assise dans
  // le gazon au lieu d'y être posée.
  const houseBase = house.y + HOUSE.h - 1
  blit(tiles, HOUSE_BUSH[0], HOUSE_BUSH[1], house.x - 1, houseBase)
  take(house.x - 1, houseBase)
  for (const [dx, dy] of HOUSE_TUFTS) {
    blit(tiles, TUFTS[0][0], TUFTS[0][1], house.x + HOUSE.w + dx, houseBase + dy)
    take(house.x + HOUSE.w + dx, houseBase + dy)
  }

  // 4. Parterres : des blocs de terre plantés dru, alignés le long des bords.
  //    Le centre de l'écran reste du gazon nu.
  const beds: Array<[number, number, number]> = []
  // Le bas de l'écran reste libre : c'est là que passent le score et la barre
  // de bas de page.
  for (let y = 2, k = 0; y + BED_H <= rows - 4; y += BED_H + BED_GAP, k++) {
    beds.push([2, y, k % SPECIES])
    beds.push([cols - BED_W - 2, y, (k + 4) % SPECIES])
  }
  // Un dernier parterre à droite, en face du bassin, pour équilibrer le bas.
  beds.push([cols - BED_W - 2, rows - 9, 7])

  for (const [bx, by, species] of beds) {
    // Un parterre ne mord jamais sur le bassin.
    let clear = true
    for (let j = 0; j < BED_H && clear; j++) {
      for (let i = 0; i < BED_W; i++) {
        if (!free(bx + i, by + j)) {
          clear = false
          break
        }
      }
    }
    if (!clear) continue

    // Contour libre : chaque ligne est rognée à gauche et à droite d'un
    // retrait qui ne bouge que d'une tuile d'une ligne à l'autre — la terre
    // garde un bord continu, sans jamais former un rectangle.
    const inside: boolean[][] = []
    let left = Math.floor(rnd() * (BED_INSET + 1))
    let right = Math.floor(rnd() * (BED_INSET + 1))
    for (let j = 0; j < BED_H; j++) {
      if (j > 0) {
        left = Math.min(BED_INSET, Math.max(0, left + Math.floor(rnd() * 3) - 1))
        right = Math.min(BED_INSET, Math.max(0, right + Math.floor(rnd() * 3) - 1))
      }
      const line: boolean[] = []
      for (let i = 0; i < BED_W; i++) line.push(i >= left && i < BED_W - right)
      inside.push(line)
    }
    const at = (i: number, j: number): boolean =>
      j >= 0 && j < BED_H && i >= 0 && i < BED_W && inside[j][i]

    // Terre : bords du bloc sur le pourtour de la forme, motifs alternés au
    // milieu (bord gauche + bord haut = tuile de coin, par construction).
    for (let j = 0; j < BED_H; j++) {
      for (let i = 0; i < BED_W; i++) {
        if (!inside[j][i]) continue
        const col = !at(i - 1, j) ? BED_COL[0] : !at(i + 1, j) ? BED_COL[3] : BED_COL[1 + (i % 2)]
        const row = !at(i, j - 1) ? BED_ROW[0] : !at(i, j + 1) ? BED_ROW[3] : BED_ROW[1 + (j % 2)]
        blit(tiles, col, row, bx + i, by + j)
        take(bx + i, by + j)
      }
    }
    // Plantation : deux variétés semées le même jour — les pieds d'un même
    // parterre ne s'écartent donc que d'un stade de pousse. Ligne par ligne,
    // pour que les fleurs du bas recouvrent celles du dessus.
    const companion = (species + 3) % SPECIES
    // Un parterre tout juste semé de temps en temps, mais la plupart sont déjà
    // sortis de terre : la terre nue est bien moins lisible qu'une floraison.
    const stage = rnd() < 0.2 ? 0 : 1 + Math.floor(rnd() * 2)
    for (let j = 0; j < BED_H; j++) {
      for (let i = 0; i < BED_W; i++) {
        if (!inside[j][i] || rnd() < BED_HOLE) continue
        const [row, h] = STAGES[stage + (rnd() < 0.4 ? 1 : 0)]
        const kind = rnd() < BED_COMPANION ? companion : species
        blit(objects, kind, row, bx + i, by + j - (h - 1), 1, h)
      }
    }

    // Un arbre planté devant la bordure basse : il déborde sur le parterre et
    // sur le gazon, ce qui donne au décor un peu de profondeur.
    if (rnd() < TREE_CHANCE) {
      const tx = bx + 1 + Math.floor(rnd() * (BED_W - TREE.w - 2))
      const ty = by + BED_H
      blit(tiles, TREE.col, TREE.row, tx, ty - (TREE.h - 1), TREE.w, TREE.h)
      for (let i = 0; i < TREE.w; i++) take(tx + i, ty)
    }
  }

  // 5. Cailloux et buissons dispersés sur le gazon libre.
  for (let n = 0, tries = 0; n < SCRUB_COUNT && tries < SCRUB_COUNT * 40; tries++) {
    const tx = Math.floor(rnd() * cols)
    const ty = Math.floor(rnd() * rows)
    if (!free(tx, ty)) continue
    const [col, row] = SCRUB[Math.floor(rnd() * SCRUB.length)]
    blit(tiles, col, row, tx, ty)
    take(tx, ty)
    n++
  }

  // 6. Touffes d'herbe, partout où il reste du gazon nu.
  for (const [tx, ty] of tufts) {
    if (!free(tx, ty)) continue
    const [col, row] = TUFTS[Math.floor(rnd() * TUFTS.length)]
    blit(tiles, col, row, tx, ty)
  }

  texture.refresh()
}
