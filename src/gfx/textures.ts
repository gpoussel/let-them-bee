import Phaser from 'phaser'

// Génère des textures placeholder au style "pixel" via des rectangles.
// À remplacer plus tard par les vrais sprites des packs (tileset Tiny Garden, objects.png)
// et par le sprite d'abeille custom. Voir GDD : "Manque à combler : le sprite d'abeille".

const PX = 4 // taille d'un "pixel" logique

function drawGrid(g: Phaser.GameObjects.Graphics, grid: string[], palette: Record<string, number>) {
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y]
    for (let x = 0; x < row.length; x++) {
      const c = row[x]
      if (c === '.' || c === ' ') continue
      const color = palette[c]
      if (color === undefined) continue
      g.fillStyle(color, 1)
      g.fillRect(x * PX, y * PX, PX, PX)
    }
  }
}

function bake(scene: Phaser.Scene, key: string, grid: string[], palette: Record<string, number>) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false)
  drawGrid(g, grid, palette)
  const w = grid[0].length * PX
  const h = grid.length * PX
  g.generateTexture(key, w, h)
  g.destroy()
}

export const TEX = {
  bee: 'tex-bee',
  beeFlap: 'tex-bee-flap',
  flowerClosed: 'tex-flower-0',
  flowerHalf: 'tex-flower-1',
  flowerOpen: 'tex-flower-2',
  hive: 'tex-hive',
  pollen: 'tex-pollen',
  logo: 'img-logo',
} as const

// Palette miel / prairie
const P = {
  y: 0xf6c445, // jaune miel
  o: 0xe89b2b, // ambre
  k: 0x3a2a1a, // rayures / contour brun foncé
  w: 0xfff6e0, // ailes crème
  g: 0x7fb069, // vert tige
  r: 0xd94f4f, // pétale rouge
  p: 0xf28ec2, // pétale rose
  c: 0xffe08a, // coeur de fleur
  b: 0x8a5a2b, // bois ruche
  d: 0xb5762f, // bois clair
} as const

function beeGrid(flap: boolean): string[] {
  // 12x12, vue de dessus, tête en haut. w = ailes (position varie selon flap)
  const up = [
    '....kk....',
    '...kwwk...',
    '..kwwwwk..',
    'w.kyyyyk.w',
    'wwkkyykwww',
    'w.kyyyyk.w',
    '..kkyykk..',
    '..kyyyyk..',
    '..kkyykk..',
    '...kyyk...',
  ]
  const down = [
    '....kk....',
    '...kyyk...',
    '..kwwwwk..',
    '..kyyyyk..',
    '.wkkyykw..',
    'w.kyyyyk.w',
    'ww kkyykww',
    'w.kyyyyk.w',
    '..kkyykk..',
    '...kyyk...',
  ]
  return flap ? down : up
}

export function bakeAll(scene: Phaser.Scene) {
  bake(scene, TEX.bee, beeGrid(false), P)
  bake(scene, TEX.beeFlap, beeGrid(true), P)

  bake(scene, TEX.flowerClosed, [
    '..gg..',
    '..gg..',
    '.cooc.',
    '.cooc.',
    '..oo..',
    '..gg..',
  ], P)

  bake(scene, TEX.flowerHalf, [
    '.r..r.',
    'rkoork',
    '.occo.',
    'rkoork',
    '.r..r.',
    '..gg..',
  ], P)

  bake(scene, TEX.flowerOpen, [
    'r.rr.r',
    'rpccpr',
    'rccccr',
    'rpccpr',
    'r.rr.r',
    '..gg..',
  ], P)

  bake(scene, TEX.hive, [
    '..dddd..',
    '.dddddd.',
    'bddddddb',
    'bbbbbbbb',
    'bbkkkkbb',
    'bbkkkkbb',
    'bbbbbbbb',
    'bbbbbbbb',
  ], P)

  bake(scene, TEX.pollen, [
    '.cc.',
    'cccc',
    'cccc',
    '.cc.',
  ], P)
}
