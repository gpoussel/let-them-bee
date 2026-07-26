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
  ui: 'img-ui',
  uiSlider: 'img-ui-slider',
  tileset: 'img-garden-tiles',
  objects: 'img-garden-objects',
  garden: 'tex-garden',
  gardenField: 'tex-garden-field',
  iconItch: 'tex-icon-itch',
  iconGithub: 'tex-icon-github',
  iconAbout: 'tex-icon-about',
  iconPrefs: 'tex-icon-prefs',
  iconNectar: 'tex-icon-nectar',
  iconHoney: 'tex-icon-honey',
  // Les mêmes gouttes, bakées au point d'art : le prix d'une alvéole se lit à
  // côté d'un chiffre de 12 px, pas d'un chiffre de 36.
  iconNectarSmall: 'tex-icon-nectar-sm',
  iconHoneySmall: 'tex-icon-honey-sm',
  iconJelly: 'tex-icon-jelly',
  iconBee: 'tex-icon-bee',
  hexIdle: 'tex-hex-idle',
  hexReady: 'tex-hex-ready',
  hexDone: 'tex-hex-done',
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

/**
 * Ruche en paille (skep) de 32x32 : un dôme de bourrelets tressés, un trou
 * d'entrée voûté et une planche d'envol.
 *
 * La grille est calculée plutôt que tapée à la main : les bourrelets, le
 * galbe et les ombres se déduisent de la silhouette, ce qui donne un dessin
 * régulier là où trente-deux lignes de texte finiraient forcément de travers.
 */
function hiveGrid(): string[] {
  const S = 32
  const rows: string[][] = Array.from({ length: S }, () => Array<string>(S).fill('.'))

  // Dôme : plus large en descendant, mais en s'évasant de moins en moins —
  // une racine carrée donne l'épaule arrondie du panier de paille.
  const TOP = 2
  const BASE = 25
  const halfAt = (y: number) => Math.round(3 + 11 * Math.sqrt((y - TOP) / (BASE - TOP)))

  for (let y = TOP; y <= BASE; y++) {
    const half = halfAt(y)
    const left = 16 - half
    const right = 15 + half
    // Un bourrelet tous les quatre rangs : c'est la corde de paille cousue.
    const seam = (y - TOP) % 4 === 3
    for (let x = left; x <= right; x++) {
      let c: string
      if (x === left || x === right) c = 'k'
      else if (x <= left + 2) c = seam ? 'o' : 'y' // lumière rasante à gauche
      else if (x >= right - 3) c = seam ? 'k' : 'b' // le flanc droit est dans l'ombre
      else c = seam ? 'b' : 'd'
      rows[y][x] = c
    }
  }

  // Entrée : une voûte creusée dans le bas du dôme.
  for (let x = 14; x <= 17; x++) rows[19][x] = 'k'
  for (let y = 20; y <= 24; y++) for (let x = 13; x <= 18; x++) rows[y][x] = 'k'
  for (let x = 14; x <= 17; x++) rows[25][x] = 'd' // le seuil, éclairé

  // Planche d'envol : elle déborde du panier, et porte son ombre.
  for (let x = 1; x <= 30; x++) {
    rows[26][x] = x <= 2 || x >= 29 ? 'k' : 'd'
    rows[27][x] = 'b'
    rows[28][x] = x <= 3 || x >= 28 ? '.' : 'k'
  }

  return rows.map((r) => r.join(''))
}

// Les icônes de liens sont monochromes (crème) : leur couleur de marque est
// appliquée en teinte au survol (cf. iconButton).
const IP = { g: 0xfff6e0 } as const

// Marque itch.io : auvent en haut, corps fendu de trois encoches.
const ICON_ITCH = [
  '................',
  '..gggggggggggg..',
  '.gggggggggggggg.',
  'gggggggggggggggg',
  'gggggggggggggggg',
  '.gggggggggggggg.',
  '.gggggggggggggg.',
  '.gggggggggggggg.',
  '.gg..gg..gg..gg.',
  '.gg..gg..gg..gg.',
  '.gg..gg..gg..gg.',
  '.gg..gg..gg..gg.',
  '.gggggggggggggg.',
  '.gggggggggggggg.',
  '..gggggggggggg..',
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

// Pastille « i » d'information (le glyphe est évidé, pas peint).
const ICON_ABOUT = [
  '................',
  '.....gggggg.....',
  '...gggggggggg...',
  '..ggggg..ggggg..',
  '..ggggg..ggggg..',
  '.gggggggggggggg.',
  '.gggggg..gggggg.',
  '.gggggg..gggggg.',
  '.gggggg..gggggg.',
  '.gggggg..gggggg.',
  '.gggggg..gggggg.',
  '..ggggg..ggggg..',
  '..gggggggggggg..',
  '...gggggggggg...',
  '.....gggggg.....',
  '................',
]

// Roue crantée des préférences : huit dents et un moyeu évidé.
const ICON_PREFS = [
  '................',
  '...g..gggg..g...',
  '...gg.gggg.gg...',
  '...gggggggggg...',
  '.gggggggggggggg.',
  '..gggg....gggg..',
  'ggggg......ggggg',
  'gggg........gggg',
  'gggg........gggg',
  'ggggg......ggggg',
  '..gggg....gggg..',
  '.gggggggggggggg.',
  '...gggggggggg...',
  '...gg.gggg.gg...',
  '...g..gggg..g...',
  '................',
]

// Goutte de nectar (pleine, avec un éclat évidé sur la joue gauche).
const ICON_NECTAR = [
  '................',
  '.......gg.......',
  '.......gg.......',
  '......gggg......',
  '......gggg......',
  '.....gggggg.....',
  '.....gggggg.....',
  '....gggggggg....',
  '....gggggggg....',
  '...gggggggggg...',
  '...gg..gggggg...',
  '...gg..gggggg...',
  '...gggggggggg...',
  '....gggggggg....',
  '......gggg......',
  '................',
]

// Pot de miel : couvercle, col, panse et bandeau d'étiquette évidé.
const ICON_HONEY = [
  '................',
  '....gggggggg....',
  '....gggggggg....',
  '.....gggggg.....',
  '...gggggggggg...',
  '..gggggggggggg..',
  '..gggggggggggg..',
  '..gg........gg..',
  '..gg........gg..',
  '..gggggggggggg..',
  '..gggggggggggg..',
  '..gggggggggggg..',
  '..gggggggggggg..',
  '...gggggggggg...',
  '....gggggggg....',
  '................',
]

// Gelée royale : la cellule hexagonale où on l'élève, en contour.
const ICON_JELLY = [
  '................',
  '......gggg......',
  '.....gg..gg.....',
  '....gg....gg....',
  '...gg......gg...',
  '..gg........gg..',
  '..gg........gg..',
  '..gg........gg..',
  '..gg........gg..',
  '..gg........gg..',
  '..gg........gg..',
  '...gg......gg...',
  '....gg....gg....',
  '.....gg..gg.....',
  '......gggg......',
  '................',
]

// Abeille vue de dessus, monochrome : l'effectif de chaque caste la reprend,
// teintée à la couleur de la caste (cf. BEE_TINT).
const ICON_BEE = [
  '................',
  '......g..g......',
  '......gggg......',
  '......gggg......',
  '..gg..gggg..gg..',
  '.gggg.gggg.gggg.',
  '.gggggggggggggg.',
  '..gg..gggg..gg..',
  '......gggg......',
  '.....gggggg.....',
  '.....g....g.....',
  '.....gggggg.....',
  '......g..g......',
  '......gggg......',
  '.......gg.......',
  '................',
]

/**
 * Rayon (centre → SOMMET) d'une alvéole du rayon d'améliorations, en px.
 *
 * Il n'est pas libre : le rayon entier doit tenir dans sa fenêtre À L'ÉCHELLE 1.
 * Le dézoomer pour l'y faire entrer rendrait la police bitmap floue — un demi-
 * pixel de monogram n'existe pas. Le rayon fait 11 R de haut (3 alvéoles de part
 * et d'autre de la ruche) pour une fenêtre de 378 px : 34 est le plus grand
 * rayon qui passe.
 */
export const HEX_R = 34
/** Largeur d'une alvéole pointe en haut : de plat à plat, et non de pointe à pointe. */
const HEX_W = Math.ceil(Math.sqrt(3) * HEX_R)
/** Hauteur d'une alvéole pointe en haut. */
const HEX_H = HEX_R * 2
/** Épaisseur du liseré, et marge qui l'empêche d'être rogné au bord de la texture. */
const HEX_LINE = 3
const HEX_PAD = 2
/**
 * Retrait du dessin par rapport au pas du pavage. Jointoyées EXACTEMENT, deux
 * voisines partagent une arête : les deux liserés se recouvrent, celui de la
 * dernière dessinée efface celui de l'autre, et le rayon devient une seule tache
 * sans découpe. En rentrant chaque hexagone de quelques pixels, chacun garde son
 * liseré entier et le fond passe entre eux — c'est la cire qui sépare les
 * alvéoles d'un vrai rayon.
 */
const HEX_GAP = 4

/**
 * Alvéole du rayon : hexagone POINTE EN HAUT, dessiné en vectoriel plutôt qu'en
 * grille de pixels — une diagonale d'hexagone rendue au gros pixel devient un
 * escalier illisible à cette taille.
 *
 * Un hexagone pointe en haut n'est PAS carré : il fait `√3·r` de large pour
 * `2r` de haut. Le baker dans une boîte carrée revenait à dessiner l'hexagone
 * couché (pointes à gauche et à droite), et le pavage axial — calculé, lui,
 * pour du pointe en haut — ne pouvait alors pas jointoyer.
 *
 * Le sprite est centré sur la texture, dont la taille reste celle du PAS du
 * pavage (`√3·R` / `2R`) même si le dessin est rentré de `HEX_GAP` : le pavage
 * ne bouge pas, seule la cire entre alvéoles apparaît.
 */
function bakeHex(scene: Phaser.Scene, key: string, fill: number, line: number): void {
  const r = HEX_R - HEX_GAP
  const w = HEX_W + HEX_PAD * 2
  const h = HEX_H + HEX_PAD * 2
  const cx = w / 2
  const cy = h / 2

  const g = scene.make.graphics({ x: 0, y: 0 }, false)
  const pts: number[] = []
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * 60 * i
    pts.push(cx + r * Math.sin(a), cy - r * Math.cos(a))
  }
  g.fillStyle(fill, 1)
  g.lineStyle(HEX_LINE, line, 1)
  g.beginPath()
  g.moveTo(pts[0], pts[1])
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1])
  g.closePath()
  g.fillPath()
  g.strokePath()
  g.generateTexture(key, w, h)
  g.destroy()
}

export function bakeAll(scene: Phaser.Scene) {
  // Les trois états d'une alvéole : achetable, hors de prix, terminée.
  bakeHex(scene, TEX.hexIdle, 0x4a655a, 0x71653f)
  bakeHex(scene, TEX.hexReady, 0x71653f, 0xf3b468)
  bakeHex(scene, TEX.hexDone, 0x639b35, 0xd6dc53)

  bake(scene, TEX.iconPrefs, ICON_PREFS, IP, ICON_PX)
  bake(scene, TEX.iconNectar, ICON_NECTAR, IP, ICON_PX)
  bake(scene, TEX.iconHoney, ICON_HONEY, IP, ICON_PX)
  // Version 16x16 des deux monnaies du rayon (un point d'art = un pixel écran).
  bake(scene, TEX.iconNectarSmall, ICON_NECTAR, IP, 1)
  bake(scene, TEX.iconHoneySmall, ICON_HONEY, IP, 1)
  bake(scene, TEX.iconJelly, ICON_JELLY, IP, ICON_PX)
  bake(scene, TEX.iconBee, ICON_BEE, IP, ICON_PX)
  bake(scene, TEX.iconItch, ICON_ITCH, IP, ICON_PX)
  bake(scene, TEX.iconGithub, ICON_GITHUB, IP, ICON_PX)
  bake(scene, TEX.iconAbout, ICON_ABOUT, IP, ICON_PX)

  // L'abeille est bakée à sa taille d'affichage : 2 points par pixel d'art,
  // comme les fleurs et la ruche. La réduire après coup revenait à la rendre
  // à une échelle fractionnaire de sa texture, d'où sa bouillie de pixels.
  bake(scene, TEX.bee, beeGrid(false), P, 2)
  bake(scene, TEX.beeFlap, beeGrid(true), P, 2)

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

  // La ruche est le seul décor dessiné à la vraie résolution du pixel art :
  // 32x32 points, bakés à 2 px écran chacun — la même densité que les fleurs
  // du tileset, pour qu'elle ne détonne pas à côté d'elles.
  bake(scene, TEX.hive, hiveGrid(), P, 2)

  bake(scene, TEX.pollen, [
    '.cc.',
    'cccc',
    'cccc',
    '.cc.',
  ], P)
}
