import Phaser from 'phaser'
import { TEX } from './textures'

// Logo animé de l'écran-titre.
//
// La source reste l'unique `public/img/logo.png` : au boot, on en dérive des
// calques (texture de base « nettoyée » + petits sprites d'animation) plutôt que
// de multiplier les fichiers d'assets. Les repères ci-dessous sont donc couplés
// au pixel près à ce PNG — les mettre à jour si le logo est redessiné.
//
// Tout est animé en pixels entiers (aucune rotation ni interpolation) pour
// rester pixel-perfect :
//   - une poussière verte saupoudrée traverse les lettres, poussée par le vent ;
//   - les ailes de l'abeille vibrent d'un pixel ;
//   - ses pattes et ses antennes oscillent ;
//   - elle cligne des yeux de temps en temps.

const LOGO_W = 138
const LOGO_H = 80

// Couleurs relevées dans le PNG source.
const GREEN: RGB = [110, 155, 61] // vert prairie (poussière)
const LETTER: RGB = [221, 222, 94] // jaune-vert des lettres « Let them »
const HEAD: RGB = [241, 178, 101] // ambre des lettres « bee » et de la tête
const WING: RGB = [157, 187, 133] // vert tendre des ailes
// Autres teintes de remplissage des lettres (variantes d'ambre) : elles font
// partie du masque de poussière.
const FILLS: RGB[] = [LETTER, HEAD, [235, 178, 105], [208, 152, 78], GREEN]
// Teintes « corps » : servent à distinguer le contour des ailes de celui du
// corps / des lettres lors de l'extraction.
const BODIES: RGB[] = [...FILLS, [110, 96, 59], [175, 138, 85], [72, 60, 51]]

const OUTLINE = 0x4a6057 // contour vert-gris (antennes)
const EYE = 0x483c33 // brun très foncé des yeux

// Zone occupée par l'abeille : exclue du masque de poussière (la poussière ne
// se dépose que sur les lettres).
const BEE = { x: 105, y: 50, w: 33, h: 30 } as const

// Hampes des deux « t », en vert dans le PNG : repeintes en jaune de lettre,
// le vert ne servant plus qu'à la poussière.
const STEMS = [
  { x: 37, y: 17, w: 8, h: 8 },
  { x: 58, y: 17, w: 8, h: 8 },
] as const

// Yeux : deux blocs de 2x3 séparés par 2 pixels de tête.
const EYES = { x: 127, y: 66, w: 6, h: 3 } as const

// Pattes : trois lignes sous le ventre, isolées sur fond transparent.
const LEGS = { x: 113, y: 77, w: 15, h: 3 } as const

// Antennes. Chaque pose est une grille (1 caractère = 1 pixel) posée à
// l'origine indiquée ; la pose 0 reproduit exactement le PNG source, dont les
// pixels sont effacés de la texture de base.
const ANTENNA_A = {
  x: 129,
  y: 56,
  poses: [
    ['......', '...###', '..###.', '.##...', '###...'], // repos
    ['...###', '..###.', '..##..', '.##...', '###...'], // relevée
    ['......', '......', '..####', '.##...', '###...'], // basse
  ],
} as const
const ANTENNA_B = {
  x: 133,
  y: 59,
  poses: [
    ['.....', '.###.', '####.'],
    ['...##', '.###.', '####.'],
    ['.....', '.##..', '#####'],
  ],
} as const

// Ordre de balayage des poses : repos → relevée → repos → basse.
const SWAY = [0, 1, 0, 2] as const
const SWAY_STEP_A = 420 // ms par pose (les deux antennes se désynchronisent)
const SWAY_STEP_B = 530
const LEG_STEP = 640

const WING_BEAT = 150 // ms entre deux battements d'aile

const DUST_TICK = 90 // ms entre deux déplacements de poussière
// Beaucoup de grains : seuls ceux qui passent sur une lettre sont visibles
// (environ un quart de la surface du logo).
const DUST_COUNT = 160
const DUST_SPEED = { min: 0.45, max: 1.15 } // px par tick
const DUST_DRIFT = 0.22 // dérive verticale max, px par tick

const BLINK_MS = 110
const BLINK_MIN = 2400
const BLINK_MAX = 6000
const DOUBLE_BLINK_CHANCE = 0.25

type RGB = [number, number, number]

const KEY = {
  base: 'logo-base',
  fx: 'logo-fx',
  wing: (i: number) => `logo-wing-${i}`,
  legs: (pose: number) => `logo-legs-${pose}`,
  antenna: (name: string, pose: number) => `logo-antenna-${name}-${pose}`,
  eyelid: 'logo-eyelid',
}

/** Calques dérivés du PNG, calculés une fois par {@link bakeLogo}. */
interface Baked {
  /** 1 = la poussière peut se déposer sur ce pixel. */
  dust: Uint8Array
  /** Position et taille de chaque aile (une texture par aile). */
  wings: Array<{ x: number; y: number }>
}
let baked: Baked | null = null

type SourceImage = HTMLImageElement | HTMLCanvasElement

function sourceImage(scene: Phaser.Scene): SourceImage {
  return scene.textures.get(TEX.logo).getSourceImage() as SourceImage
}

/** Copie le PNG source dans un canvas 2D hors écran, pour lire ses pixels. */
function readSource(scene: Phaser.Scene): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = LOGO_W
  canvas.height = LOGO_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('logo: contexte 2D indisponible')
  ctx.drawImage(sourceImage(scene), 0, 0)
  return ctx.getImageData(0, 0, LOGO_W, LOGO_H)
}

function rgbAt(data: ImageData, x: number, y: number): RGB | null {
  const i = (y * LOGO_W + x) * 4
  if (data.data[i + 3] !== 255) return null
  return [data.data[i], data.data[i + 1], data.data[i + 2]]
}

function same(a: RGB | null, b: RGB): boolean {
  return a !== null && a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}

function oneOf(a: RGB | null, list: RGB[]): boolean {
  return list.some((rgb) => same(a, rgb))
}

function css(rgb: RGB): string {
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
}

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

/** Contour sombre (ailes, pattes, lettres) : vert-gris très désaturé. */
function isOutline(rgb: RGB | null): boolean {
  return rgb !== null && rgb[0] < 120 && rgb[1] < 110
}

function key(x: number, y: number): number {
  return y * LOGO_W + x
}

/** Crée une texture canvas vide, filtrée en NEAREST (pixel art). */
function canvasTexture(
  scene: Phaser.Scene,
  name: string,
  w: number,
  h: number,
): Phaser.Textures.CanvasTexture {
  if (scene.textures.exists(name)) scene.textures.remove(name)
  const tex = scene.textures.createCanvas(name, w, h)
  if (!tex) throw new Error(`logo: création de la texture ${name} impossible`)
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST)
  return tex
}

function drawGrid(ctx: CanvasRenderingContext2D, rows: readonly string[], color: number): void {
  ctx.fillStyle = hex(color)
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '#') ctx.fillRect(x, y, 1, 1)
    }
  })
}

/**
 * Pixels des ailes : le remplissage vert tendre, plus les pixels de contour qui
 * le bordent SANS toucher le corps ou une lettre (sinon on emporterait le
 * contour du corps avec l'aile).
 */
function wingCells(data: ImageData): Set<number> {
  const cells = new Set<number>()
  const fill: Array<[number, number]> = []
  for (let y = 0; y < LOGO_H; y++) {
    for (let x = 0; x < LOGO_W; x++) {
      if (same(rgbAt(data, x, y), WING)) {
        fill.push([x, y])
        cells.add(key(x, y))
      }
    }
  }
  const neighbours = (x: number, y: number): Array<[number, number]> => {
    const out: Array<[number, number]> = []
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && nx < LOGO_W && ny >= 0 && ny < LOGO_H) out.push([nx, ny])
      }
    }
    return out
  }
  for (const [x, y] of fill) {
    for (const [nx, ny] of neighbours(x, y)) {
      if (!isOutline(rgbAt(data, nx, ny))) continue
      const touchesBody = neighbours(nx, ny).some(([bx, by]) => oneOf(rgbAt(data, bx, by), BODIES))
      if (!touchesBody) cells.add(key(nx, ny))
    }
  }
  return cells
}

/** Sépare un ensemble de pixels en composantes connexes (8-connexité). */
function components(cells: Set<number>): Array<Set<number>> {
  const seen = new Set<number>()
  const out: Array<Set<number>> = []
  for (const start of cells) {
    if (seen.has(start)) continue
    const comp = new Set<number>()
    const stack = [start]
    seen.add(start)
    while (stack.length) {
      const k = stack.pop() as number
      comp.add(k)
      const x = k % LOGO_W
      const y = (k - x) / LOGO_W
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const n = key(x + dx, y + dy)
          if (cells.has(n) && !seen.has(n)) {
            seen.add(n)
            stack.push(n)
          }
        }
      }
    }
    out.push(comp)
  }
  return out
}

/**
 * Dérive tous les calques du logo depuis le PNG source. À appeler une fois,
 * après le chargement de `TEX.logo` (cf. BootScene).
 */
export function bakeLogo(scene: Phaser.Scene): void {
  const data = readSource(scene)
  const wings = wingCells(data)

  // 1. Texture de base : le logo dont on retire tous les éléments animés.
  const base = canvasTexture(scene, KEY.base, LOGO_W, LOGO_H)
  base.draw(0, 0, sourceImage(scene))
  const bctx = base.context
  for (const antenna of [ANTENNA_A, ANTENNA_B]) {
    antenna.poses[0].forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '#') bctx.clearRect(antenna.x + x, antenna.y + y, 1, 1)
      }
    })
  }
  for (const k of wings) bctx.clearRect(k % LOGO_W, Math.floor(k / LOGO_W), 1, 1)
  bctx.clearRect(LEGS.x, LEGS.y, LEGS.w, LEGS.h)
  // Les hampes vertes des « t » repassent en jaune : le vert n'est plus qu'une
  // poussière qui balaie l'ensemble des lettres.
  bctx.fillStyle = css(LETTER)
  for (const stem of STEMS) {
    for (let y = stem.y; y < stem.y + stem.h; y++) {
      for (let x = stem.x; x < stem.x + stem.w; x++) {
        if (same(rgbAt(data, x, y), GREEN)) bctx.fillRect(x, y, 1, 1)
      }
    }
  }
  base.refresh()

  // 2. Une texture par aile, recadrée sur sa boîte englobante.
  const wingBoxes = components(wings)
    .map((comp) => {
      const xs = [...comp].map((k) => k % LOGO_W)
      const ys = [...comp].map((k) => Math.floor(k / LOGO_W))
      return { comp, x: Math.min(...xs), y: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) }
    })
    .sort((a, b) => a.x - b.x)
  wingBoxes.forEach((box, i) => {
    const w = box.x2 - box.x + 1
    const h = box.y2 - box.y + 1
    const tex = canvasTexture(scene, KEY.wing(i), w, h)
    const ctx = tex.context
    for (const k of box.comp) {
      const x = k % LOGO_W
      const y = Math.floor(k / LOGO_W)
      const rgb = rgbAt(data, x, y)
      if (!rgb) continue
      ctx.fillStyle = css(rgb)
      ctx.fillRect(x - box.x, y - box.y, 1, 1)
    }
    tex.refresh()
  })

  // 3. Pattes : la pose 0 est celle du PNG, les deux autres décalent d'un pixel
  //    les deux lignes basses (la ligne du haut reste accrochée au ventre).
  for (let pose = 0; pose < 3; pose++) {
    const shift = pose === 0 ? 0 : pose === 1 ? 1 : -1
    const tex = canvasTexture(scene, KEY.legs(pose), LEGS.w + 2, LEGS.h)
    const ctx = tex.context
    for (let y = 0; y < LEGS.h; y++) {
      for (let x = 0; x < LEGS.w; x++) {
        const rgb = rgbAt(data, LEGS.x + x, LEGS.y + y)
        if (!rgb) continue
        ctx.fillStyle = css(rgb)
        ctx.fillRect(x + 1 + (y === 0 ? 0 : shift), y, 1, 1)
      }
    }
    tex.refresh()
  }

  // 4. Poses d'antennes.
  for (const [name, antenna] of [
    ['a', ANTENNA_A],
    ['b', ANTENNA_B],
  ] as const) {
    antenna.poses.forEach((pose, i) => {
      const tex = canvasTexture(scene, KEY.antenna(name, i), pose[0].length, pose.length)
      drawGrid(tex.context, pose, OUTLINE)
      tex.refresh()
    })
  }

  // 5. Paupières : un rectangle couleur tête qui masque les yeux, barré d'un
  //    trait sombre à leur hauteur.
  const lid = canvasTexture(scene, KEY.eyelid, EYES.w, EYES.h)
  const lctx = lid.context
  lctx.fillStyle = css(HEAD)
  lctx.fillRect(0, 0, EYES.w, EYES.h)
  lctx.fillStyle = hex(EYE)
  lctx.fillRect(0, 1, 2, 1)
  lctx.fillRect(4, 1, 2, 1)
  lid.refresh()

  // 6. Masque de poussière : le remplissage des lettres, abeille exclue.
  const dust = new Uint8Array(LOGO_W * LOGO_H)
  for (let y = 0; y < LOGO_H; y++) {
    for (let x = 0; x < LOGO_W; x++) {
      const inBee = x >= BEE.x && x < BEE.x + BEE.w && y >= BEE.y && y < BEE.y + BEE.h
      if (!inBee && oneOf(rgbAt(data, x, y), FILLS)) dust[key(x, y)] = 1
    }
  }
  canvasTexture(scene, KEY.fx, LOGO_W, LOGO_H)

  baked = { dust, wings: wingBoxes.map((b) => ({ x: b.x, y: b.y })) }
}

interface Mote {
  x: number
  y: number
  vx: number
  vy: number
}

/**
 * Compose le logo animé et le renvoie sous forme de conteneur (origine au
 * centre du logo, comme une image). Les timers meurent avec la scène.
 */
export function createLogo(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale: number,
): Phaser.GameObjects.Container {
  if (!baked) throw new Error('logo: bakeLogo() n’a pas été appelé')
  const { dust, wings } = baked

  const container = scene.add.container(x, y).setScale(scale)
  // Les enfants sont posés en coordonnées « logo » (origine en haut à gauche),
  // recentrées via cet offset.
  const ox = -LOGO_W / 2
  const oy = -LOGO_H / 2
  const put = (name: string, px: number, py: number) =>
    scene.add.image(ox + px, oy + py, name).setOrigin(0, 0)

  container.add(put(KEY.base, 0, 0))

  // Ailes : un battement d'un pixel vers le haut, en opposition de phase.
  wings.forEach((wing, i) => {
    const sprite = put(KEY.wing(i), wing.x, wing.y)
    container.add(sprite)
    const rest = sprite.y
    let up = i % 2 === 1
    scene.time.addEvent({
      delay: WING_BEAT,
      loop: true,
      callback: () => {
        up = !up
        sprite.y = rest - (up ? 1 : 0)
      },
    })
  })

  // Pattes et antennes : balayage entre trois poses, chacune à son rythme.
  const swayer = (name: (pose: number) => string, px: number, py: number, step: number) => {
    const sprite = put(name(0), px, py)
    container.add(sprite)
    let i = 0
    scene.time.addEvent({
      delay: step,
      loop: true,
      callback: () => {
        i = (i + 1) % SWAY.length
        sprite.setTexture(name(SWAY[i]))
      },
    })
  }
  swayer(KEY.legs, LEGS.x - 1, LEGS.y, LEG_STEP)
  swayer((pose) => KEY.antenna('a', pose), ANTENNA_A.x, ANTENNA_A.y, SWAY_STEP_A)
  swayer((pose) => KEY.antenna('b', pose), ANTENNA_B.x, ANTENNA_B.y, SWAY_STEP_B)

  // Poussière : des pixels verts poussés vers la droite, visibles uniquement
  // là où ils passent sur une lettre.
  const fx = scene.textures.get(KEY.fx) as Phaser.Textures.CanvasTexture
  const fxCtx = fx.context
  const respawn = (mote: Mote, spread: boolean): void => {
    mote.x = spread ? Math.random() * LOGO_W : -Math.random() * 12
    mote.y = Math.random() * LOGO_H
    mote.vx = Phaser.Math.FloatBetween(DUST_SPEED.min, DUST_SPEED.max)
    mote.vy = Phaser.Math.FloatBetween(-DUST_DRIFT, DUST_DRIFT)
  }
  const motes: Mote[] = Array.from({ length: DUST_COUNT }, () => {
    const mote: Mote = { x: 0, y: 0, vx: 0, vy: 0 }
    respawn(mote, true)
    return mote
  })
  container.add(put(KEY.fx, 0, 0))
  scene.time.addEvent({
    delay: DUST_TICK,
    loop: true,
    callback: () => {
      fxCtx.clearRect(0, 0, LOGO_W, LOGO_H)
      fxCtx.fillStyle = css(GREEN)
      for (const mote of motes) {
        mote.x += mote.vx
        mote.y += mote.vy
        if (mote.x > LOGO_W || mote.y < 0 || mote.y > LOGO_H) {
          respawn(mote, false)
          continue
        }
        const px = Math.round(mote.x)
        const py = Math.round(mote.y)
        if (px >= 0 && dust[key(px, py)]) fxCtx.fillRect(px, py, 1, 1)
      }
      fx.refresh()
    },
  })

  // Clignement : la paupière n'apparaît que le temps du clignement.
  const lid = put(KEY.eyelid, EYES.x, EYES.y).setVisible(false)
  container.add(lid)
  const scheduleBlink = (): void => {
    // Un clignement sur quatre est double.
    const twice = Math.random() < DOUBLE_BLINK_CHANCE
    scene.time.delayedCall(Phaser.Math.Between(BLINK_MIN, BLINK_MAX), () => blink(twice))
  }
  const blink = (twice: boolean): void => {
    lid.setVisible(true)
    scene.time.delayedCall(BLINK_MS, () => {
      lid.setVisible(false)
      if (twice) scene.time.delayedCall(BLINK_MS, () => blink(false))
      else scheduleBlink()
    })
  }
  scheduleBlink()

  return container
}
