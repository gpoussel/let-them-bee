// Helpers de texte pixel-perfect basés sur la bitmap font monogram.
// Toujours passer par ici plutôt que scene.add.text (canvas anti-aliasé, flou).

import Phaser from 'phaser'
import { FONT_KEY } from '../gfx/font'

/** '#rrggbb' -> 0xrrggbb pour le tint des BitmapText. */
export function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}

/**
 * Crée un BitmapText monogram teinté. `size` doit être un multiple de 12
 * (taille de cellule native) pour rester net.
 */
export function pixelText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: number,
  colorHex: string,
): Phaser.GameObjects.BitmapText {
  const t = scene.add.bitmapText(x, y, FONT_KEY, text, size)
  t.setTint(hexToInt(colorHex))
  return t
}
