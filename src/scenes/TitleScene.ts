import Phaser from 'phaser'
import { STR } from '../config/strings'
import { GAME, WORLD } from '../config/game'
import { COLORS, HEX, FONTS } from '../ui/theme'
import { pixelText } from '../ui/text'
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

    pixelText(this, width / 2, height * 0.3, STR.title, FONTS.sizeTitle, HEX.cream).setOrigin(0.5)
    pixelText(this, width / 2, height * 0.3 + 44, STR.tagline, FONTS.sizeSmall, HEX.honey).setOrigin(
      0.5,
    )

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
    pixelText(
      this,
      width / 2,
      height * 0.74,
      `${STR.honey} record : ${Math.floor(gameState.bestHoney)}   -   Reines : ${gameState.queens}`,
      FONTS.sizeSmall,
      HEX.cream,
    ).setOrigin(0.5)

    if (hasSave) {
      this.makeButton(width / 2, height * 0.84, STR.reset, () => {
        GameState.clear()
        this.scene.restart()
      })
    }

    pixelText(this, 6, height - 20, `v${GAME.version}`, FONTS.sizeSmall, HEX.cream).setAlpha(0.5)
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void): void {
    const t = pixelText(this, 0, 0, label, FONTS.sizeButton, HEX.cream).setOrigin(0.5)
    const padX = 16
    const padY = 8
    const bg = this.add
      .rectangle(0, 0, t.width + padX * 2, t.height + padY * 2, 0x8a5a2b)
      .setOrigin(0.5)
    const btn = this.add.container(x, y, [bg, t])
    bg.setInteractive({ useHandCursor: true })
    bg.on('pointerover', () => btn.setScale(1.06))
    bg.on('pointerout', () => btn.setScale(1))
    bg.on('pointerdown', onClick)
  }
}
