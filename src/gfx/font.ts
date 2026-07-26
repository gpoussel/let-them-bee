// Génère une VRAIE bitmap font Phaser à partir des données pixel de « monogram »
// (CC0, Vinícius Menézio — cf. monogram-CREDITS.txt).
//
// Pourquoi pas la TTF ? Le canvas rasterise le texte avec de l'anti-aliasing, et
// monogram n'est pas alignée sur une grille pixel entière (unitsPerEm=1024, pas de
// diviseur propre) → contours gris flous, magnifiés par le scaling du canvas.
// En bakant un atlas de pixels pleins (blanc/transparent) et en l'affichant via
// BitmapText (échantillonnage NEAREST, échelle entière), le texte devient
// parfaitement net, exactement comme les sprites pixel-art.

import Phaser from 'phaser'
import glyphs from './monogram-bitmap.json'

export const FONT_KEY = 'monogram'

// Chaque glyphe = 12 lignes ; chaque valeur est un masque de bits, le bit b
// correspond à la colonne b depuis la gauche. Hauteur de cellule = 12px natif.
const CELL_H = 12
const GAP = 1 // colonne d'espacement entre glyphes
const SPACE_ADVANCE = 4 // largeur de l'espace (absent des données)
const ATLAS_MAX_W = 512

type GlyphData = Record<string, number[]>
const DATA = glyphs as GlyphData

interface Baked {
  code: number
  rows: number[]
  left: number // première colonne utilisée
  width: number // largeur réelle du glyphe en pixels
}

// Analyse un glyphe : plage de colonnes réellement utilisées (pour un rendu
// proportionnel fidèle à monogram).
function analyze(rows: number[]): { left: number; width: number } {
  let minBit = 99
  let maxBit = -1
  for (const v of rows) {
    if (v === 0) continue
    for (let b = 0; b < 16; b++) {
      if (v & (1 << b)) {
        if (b < minBit) minBit = b
        if (b > maxBit) maxBit = b
      }
    }
  }
  if (maxBit < 0) return { left: 0, width: 0 }
  return { left: minBit, width: maxBit - minBit + 1 }
}

/**
 * Bake l'atlas monogram dans le TextureManager et enregistre la bitmap font
 * dans le cache. À appeler une fois au boot (avant toute création de BitmapText).
 */
export function bakeFont(scene: Phaser.Scene): void {
  if (scene.cache.bitmapFont.has(FONT_KEY)) return

  // 1) Analyse + placement des glyphes dans l'atlas.
  const baked: Baked[] = []
  for (const key of Object.keys(DATA)) {
    const rows = DATA[key]
    const { left, width } = analyze(rows)
    baked.push({ code: key.charCodeAt(0), rows, left, width })
  }

  // Positionnement : on empile horizontalement, retour à la ligne à ATLAS_MAX_W.
  const pad = 1
  let x = pad
  let y = pad
  const rowH = CELL_H + pad
  const placed: Record<number, { x: number; y: number; w: number }> = {}
  for (const g of baked) {
    const w = Math.max(g.width, 1)
    if (x + w + pad > ATLAS_MAX_W) {
      x = pad
      y += rowH
    }
    placed[g.code] = { x, y, w }
    x += w + pad
  }
  const atlasW = ATLAS_MAX_W
  const atlasH = y + rowH

  // 2) Dessin de l'atlas (pixels pleins, sans anti-aliasing).
  const canvas = Phaser.Display.Canvas.CanvasPool.create2D(scene, atlasW, atlasH)
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- un canvas fraîchement créé a toujours un contexte 2D
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#ffffff'
  for (const g of baked) {
    const p = placed[g.code]
    for (let r = 0; r < g.rows.length; r++) {
      const v = g.rows[r]
      if (v === 0) continue
      for (let c = 0; c < g.width; c++) {
        if (v & (1 << (g.left + c))) ctx.fillRect(p.x + c, p.y + r, 1, 1)
      }
    }
  }

  const texKey = FONT_KEY + '-atlas'
  if (scene.textures.exists(texKey)) scene.textures.remove(texKey)
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- la clé vient d'être libérée juste au-dessus
  const texture = scene.textures.addCanvas(texKey, canvas)!
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST)

  // 3) Construction de la structure BitmapFontData attendue par Phaser.
  const chars: Record<number, unknown> = {}
  const addChar = (code: number, gx: number, gy: number, w: number, advance: number): void => {
    chars[code] = {
      x: gx,
      y: gy,
      width: w,
      height: CELL_H,
      centerX: Math.floor(w / 2),
      centerY: Math.floor(CELL_H / 2),
      xOffset: 0,
      yOffset: 0,
      xAdvance: advance,
      data: {},
      kerning: {},
      // Phaser 4 utilise l'axe V inversé (origine en bas à gauche, cf.
      // ParseRetroFont) : v = 1 - y/hauteur. Sans ça les glyphes sont
      // retournés verticalement et le texte apparaît illisible.
      u0: gx / atlasW,
      v0: 1 - gy / atlasH,
      u1: (gx + w) / atlasW,
      v1: 1 - (gy + CELL_H) / atlasH,
    }
  }
  for (const g of baked) {
    const p = placed[g.code]
    addChar(g.code, p.x, p.y, p.w, g.width + GAP)
  }
  // Espace (absent des données).
  addChar(32, 0, 0, 0, SPACE_ADVANCE)

  const fontData = {
    font: FONT_KEY,
    size: CELL_H,
    lineHeight: CELL_H,
    chars,
  }

  scene.cache.bitmapFont.add(FONT_KEY, { data: fontData, texture: texKey, frame: null })
}
