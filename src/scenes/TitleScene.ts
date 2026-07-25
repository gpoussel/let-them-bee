import Phaser from 'phaser'
import { STR } from '../config/strings'
import { GAME, WORLD } from '../config/game'
import { COLORS, FONTS } from '../ui/theme'
import { FONT_KEY } from '../gfx/font'
import { Ui, button, OriginX, OriginY } from '../ui/pixui'
import { TEX } from '../gfx/textures'
import { gameState, GameState } from '../systems/GameState'

const BTN_BG = 0x8a5a2b
const BTN_BG_HOVER = 0xa66c34

// Écran-titre : logo, abeille qui tourne, boutons Butiner / Continuer / Reset.
// Layout entièrement posé via pixui (ancré au centre / coin bas-gauche).
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title')
  }

  create(): void {
    const { width, height } = WORLD
    this.cameras.main.setBackgroundColor(COLORS.grassB)

    const hasSave = gameState.load()
    const ui = new Ui(this)
    const center = ui.center

    // Offsets exprimés depuis le centre de l'écran.
    const cy = height / 2
    center.bitmapText({
      font: FONT_KEY,
      size: FONTS.sizeSmall,
      text: STR.tagline,
      tint: COLORS.honey,
      x: 0,
      y: height * 0.3 + 132 - cy,
      originX: OriginX.Center,
      originY: OriginY.Center,
    })

    // Bouton principal.
    button(center, {
      font: FONT_KEY,
      size: FONTS.sizeButton,
      label: hasSave ? STR.continue : STR.play,
      color: COLORS.cream,
      bg: BTN_BG,
      bgHover: BTN_BG_HOVER,
      x: 0,
      y: height * 0.62 - cy,
      onClick: () => this.scene.start('Game'),
    })

    // Meilleur score / reines.
    center.bitmapText({
      font: FONT_KEY,
      size: FONTS.sizeSmall,
      text: `${STR.best} ${STR.honey.toLowerCase()}: ${Math.floor(gameState.bestHoney)}   -   ${STR.queens}: ${gameState.queens}`,
      tint: COLORS.cream,
      x: 0,
      y: height * 0.74 - cy,
      originX: OriginX.Center,
      originY: OriginY.Center,
    })

    if (hasSave) {
      button(center, {
        font: FONT_KEY,
        size: FONTS.sizeButton,
        label: STR.reset,
        color: COLORS.cream,
        bg: BTN_BG,
        bgHover: BTN_BG_HOVER,
        x: 0,
        y: height * 0.84 - cy,
        onClick: () => {
          GameState.clear()
          this.scene.restart()
        },
      })
    }

    ui.at(OriginX.Left, OriginY.Bottom).bitmapText({
      font: FONT_KEY,
      size: FONTS.sizeSmall,
      text: `v${GAME.version}`,
      tint: COLORS.cream,
      x: 6,
      y: 20,
      originX: OriginX.Left,
      originY: OriginY.Bottom,
    })

    ui.commit()

    // Logo (pixel art, x3) au-dessus du layout.
    this.add.image(width / 2, height * 0.3, TEX.logo).setScale(3)

  }
}
