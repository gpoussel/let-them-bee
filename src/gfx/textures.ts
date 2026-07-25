import Phaser from 'phaser'

// Génère des textures placeholder au style "pixel" via des rectangles.
// À remplacer plus tard par les vrais sprites des packs (tileset Tiny Garden, objects.png)
// et par le sprite d'abeille custom. Voir GDD : "Manque à combler : le sprite d'abeille".

const PX = 4 // taille d'un "pixel" logique

function drawGrid(
  g: Phaser.GameObjects.Graphics,
  grid: string[],
  palette: Record<string, number>,
  px: number,
) {
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y]
    for (let x = 0; x < row.length; x++) {
      const c = row[x]
      if (c === '.' || c === ' ') continue
      const color = palette[c]
      if (color === undefined) continue
      g.fillStyle(color, 1)
      g.fillRect(x * px, y * px, px, px)
    }
  }
}

function bake(
  scene: Phaser.Scene,
  key: string,
  grid: string[],
  palette: Record<string, number>,
  px: number = PX,
) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false)
  drawGrid(g, grid, palette, px)
  const w = grid[0].length * px
  const h = grid.length * px
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
  iconItch: 'tex-icon-itch',
  iconGithub: 'tex-icon-github',
  iconAbout: 'tex-icon-about',
} as const

// Les icônes du bas de l'écran-titre sont dessinées sur une grille 16x16 et
// bakées en x2 (32x32) : taille d'affichage native, donc pixel-perfect sans
// scaling au rendu.
const ICON_PX = 2

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

// Palette dédiée aux icônes de liens (couleurs de marque + crème/brun du thème).
const IP = {
  r: 0xfa5c5c, // rouge itch.io
  w: 0xfff6e0, // crème (fentes de l'icône itch, silhouette GitHub)
  g: 0xfff6e0,
  c: 0xfff6e0, // disque crème de l'icône « about » (teinté au survol)
  k: 0x3a2a1a, // brun foncé (glyphe « i »)
} as const

// Marque itch.io : auvent en haut, corps fendu de trois encoches.
const ICON_ITCH = [
  '................',
  '..rrrrrrrrrrrr..',
  '.rrrrrrrrrrrrrr.',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  '.rrrrrrrrrrrrrr.',
  '.rrrrrrrrrrrrrr.',
  '.rrrrrrrrrrrrrr.',
  '.rrwwrrwwrrwwrr.',
  '.rrwwrrwwrrwwrr.',
  '.rrwwrrwwrrwwrr.',
  '.rrwwrrwwrrwwrr.',
  '.rrrrrrrrrrrrrr.',
  '.rrrrrrrrrrrrrr.',
  '..rrrrrrrrrrrr..',
  '................',
]

// Marque GitHub : « invertocat », octocat évidé dans un disque plein
// (oreilles, bras écartés, deux pattes).
const ICON_GITHUB = [
  '................',
  '.....gggggg.....',
  '...gggggggggg...',
  '..gggggggggggg..',
  '..ggg.gggg.ggg..',
  '.ggg........ggg.',
  '.ggg........ggg.',
  '.gg..........gg.',
  '.ggg........ggg.',
  '.gggg..gg..gggg.',
  '.gggg..gg..gggg.',
  '..gggggggggggg..',
  '..gggggggggggg..',
  '...gggggggggg...',
  '.....gggggg.....',
  '................',
]

// Pastille « i » d'information.
const ICON_ABOUT = [
  '................',
  '.....cccccc.....',
  '...cccccccccc...',
  '..ccccckkccccc..',
  '..ccccckkccccc..',
  '.cccccccccccccc.',
  '.cccccckkcccccc.',
  '.cccccckkcccccc.',
  '.cccccckkcccccc.',
  '.cccccckkcccccc.',
  '.cccccckkcccccc.',
  '..ccccckkccccc..',
  '..cccccccccccc..',
  '...cccccccccc...',
  '.....cccccc.....',
  '................',
]

export function bakeAll(scene: Phaser.Scene) {
  bake(scene, TEX.iconItch, ICON_ITCH, IP, ICON_PX)
  bake(scene, TEX.iconGithub, ICON_GITHUB, IP, ICON_PX)
  bake(scene, TEX.iconAbout, ICON_ABOUT, IP, ICON_PX)

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
