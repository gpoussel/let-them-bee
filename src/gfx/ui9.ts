import Phaser from 'phaser'
import { TEX } from './textures'

// Tileset d'interface (extrait de Cozyland UI) découpé en « nine-slice ».
//
// `public/img/ui.png` contient six tuiles de 48x48 (2 px d'espacement pour
// éviter tout bavage de texture au redimensionnement) :
//
//        brun        ambre       clair
//   ┌───────────┬───────────┬───────────┐
//   │  plain    │  plain    │  plain    │  bord simple
//   ├───────────┼───────────┼───────────┤
//   │  inset    │  inset    │  inset    │  bord doublé d'un liseré clair
//   └───────────┴───────────┴───────────┘
//
// Chaque tuile est déclarée en scale9 avec des bords de 16 px : les coins
// restent intacts, seules les bandes centrales s'étirent. Un composant peut
// donc prendre n'importe quelle taille >= 32x32 (cf. {@link UI9_MIN}).

const TILE = 48
const SPACING = 2
// Les coins arrondis du tileset tiennent dans 8 px : c'est l'épaisseur de bord
// la plus fine qui les préserve, et donc la plus petite taille possible pour un
// bouton (2 x 8 px). Au-delà, seules les bandes centrales s'étirent.
/** Épaisseur des bords non étirables (coins du nine-slice). */
export const UI9_BORDER = 8
/** Taille minimale d'un nine-slice : les deux bords, sans centre. */
export const UI9_MIN = UI9_BORDER * 2

/** Tuiles disponibles (nom de frame dans la texture `TEX.ui`). */
export const UI9 = {
  plainDark: 'ui9-plain-dark',
  plainAmber: 'ui9-plain-amber',
  plainLight: 'ui9-plain-light',
  insetDark: 'ui9-inset-dark',
  insetAmber: 'ui9-inset-amber',
  insetLight: 'ui9-inset-light',
} as const

/** Nom d'une tuile de l'interface. */
export type Ui9Skin = (typeof UI9)[keyof typeof UI9]

// Position (colonne, ligne) de chaque tuile dans la planche.
const LAYOUT: [Ui9Skin, number, number][] = [
  [UI9.plainDark, 0, 0],
  [UI9.plainAmber, 1, 0],
  [UI9.plainLight, 2, 0],
  [UI9.insetDark, 0, 1],
  [UI9.insetAmber, 1, 1],
  [UI9.insetLight, 2, 1],
]

// Planche du curseur (`public/img/ui-slider.png`), extraite du même tileset :
// trois rails de 48x16 (sombre, ambre, clair) puis deux poignées de 16x16
// (repos, survol), espacés de 2 px.
const SLIDER_RAIL_W = 48
const SLIDER_H = 16
/** Épaisseur des extrémités non étirables d'un rail. */
export const SLIDER_CAP = 8

/** Frames de la planche du curseur (texture `TEX.uiSlider`). */
export const SLIDER = {
  railDark: 'slider-rail-dark',
  railAmber: 'slider-rail-amber',
  railLight: 'slider-rail-light',
  knob: 'slider-knob',
  knobHover: 'slider-knob-hover',
} as const

/** Découpe la planche du curseur. À appeler au boot, après chargement. */
export function bakeSlider(scene: Phaser.Scene): void {
  const texture = scene.textures.get(TEX.uiSlider)
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST)

  const rails: [string, number][] = [
    [SLIDER.railDark, 0],
    [SLIDER.railAmber, 50],
    [SLIDER.railLight, 100],
  ]
  for (const [name, x] of rails) {
    if (texture.has(name)) continue
    const frame = texture.add(name, 0, x, 0, SLIDER_RAIL_W, SLIDER_H)
    if (!frame) continue
    // Rail étirable horizontalement seulement : les deux extrémités arrondies
    // restent intactes, la hauteur est celle de la planche.
    const center = SLIDER_RAIL_W - SLIDER_CAP * 2
    frame.setScale9(SLIDER_CAP, 0, center, SLIDER_H)
    frame.customData = { scale9Borders: { x: SLIDER_CAP, y: 0, w: center, h: SLIDER_H } }
  }

  const knobs: [string, number][] = [
    [SLIDER.knob, 150],
    [SLIDER.knobHover, 168],
  ]
  for (const [name, x] of knobs) {
    if (texture.has(name)) continue
    texture.add(name, 0, x, 0, SLIDER_H, SLIDER_H)
  }
}

/**
 * Découpe la planche d'interface en frames nine-slice. À appeler une fois au
 * boot, après le chargement de `TEX.ui`.
 */
export function bakeUi9(scene: Phaser.Scene): void {
  const texture = scene.textures.get(TEX.ui)
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST)
  for (const [name, col, row] of LAYOUT) {
    if (texture.has(name)) continue
    const frame = texture.add(name, 0, col * (TILE + SPACING), row * (TILE + SPACING), TILE, TILE)
    if (!frame) continue
    // Rectangle central étirable : tout sauf les bords de 16 px.
    const center = TILE - UI9_MIN
    frame.setScale9(UI9_BORDER, UI9_BORDER, center, center)
    // `setScale9` renseigne les données lues par Phaser ; pixui, lui, cherche
    // les bordures dans `customData` (format Texture Packer) pour décider
    // qu'une image est étirable. On lui donne la même information.
    frame.customData = { scale9Borders: { x: UI9_BORDER, y: UI9_BORDER, w: center, h: center } }
  }
}
