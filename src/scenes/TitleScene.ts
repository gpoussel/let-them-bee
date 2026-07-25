import Phaser from 'phaser'
import { STR } from '../config/strings'
import { GAME, WORLD } from '../config/game'
import { COLORS, HEX, FONTS } from '../ui/theme'
import { TEX } from '../gfx/textures'
import { gameState, GameState } from '../systems/GameState'

// Écran-titre : logo, abeille qui tourne, boutons Butiner / Continuer / Reset.
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title')
  }

  create(): void {
    const { width, height } = WORLD
    this.cameras.main.setBackgroundColor(COLORS.grassB)

    const hasSave = gameState.load()

    this.add
      .text(width / 2, height * 0.3, STR.title, {
        fontFamily: FONTS.ui,
        fontSize: FONTS.sizeTitle,
        color: HEX.cream,
      })
      .setOrigin(0.5)
    this.add
      .text(width / 2, height * 0.3 + 44, STR.tagline, {
        fontFamily: FONTS.ui,
        fontSize: FONTS.sizeSmall,
        color: HEX.honey,
      })
      .setOrigin(0.5)

    // Abeille qui tourne autour du titre.
    const bee = this.add.sprite(width / 2, height * 0.3, TEX.bee)
    this.tweens.add({
      targets: { a: 0 },
      a: Math.PI * 2,
      duration: 4000,
      repeat: -1,
      onUpdate: (_tw, t) => {
        const a = (t as { a: number }).a
        bee.setPosition(width / 2 + Math.cos(a) * 140, height * 0.3 + Math.sin(a) * 50)
        bee.setRotation(a + Math.PI / 2)
      },
    })

    // Bouton principal
    this.makeButton(width / 2, height * 0.62, hasSave ? STR.continue : STR.play, () => {
      this.scene.start('Game')
    })

    // Meilleur score / reines
    this.add
      .text(
        width / 2,
        height * 0.74,
        `${STR.honey} record : ${Math.floor(gameState.bestHoney)}   •   Reines : ${gameState.queens}`,
        { fontFamily: FONTS.ui, fontSize: FONTS.sizeSmall, color: HEX.cream },
      )
      .setOrigin(0.5)

    if (hasSave) {
      this.makeButton(width / 2, height * 0.84, STR.reset, () => {
        GameState.clear()
        this.scene.restart()
      })
    }

    this.add
      .text(6, height - 16, `v${GAME.version}`, {
        fontFamily: FONTS.ui,
        fontSize: FONTS.sizeSmall,
        color: HEX.cream,
      })
      .setAlpha(0.5)
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void): void {
    const t = this.add
      .text(x, y, label, {
        fontFamily: FONTS.ui,
        fontSize: FONTS.sizeButton,
        color: HEX.cream,
        backgroundColor: '#8a5a2b',
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
    t.on('pointerover', () => t.setScale(1.06))
    t.on('pointerout', () => t.setScale(1))
    t.on('pointerdown', onClick)
  }
}
