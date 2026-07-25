import Phaser from 'phaser'
import { STR } from '../config/strings'
import { gameState } from '../systems/GameState'
import { WORLD } from '../config/game'
import { COLORS, HEX, FONTS, HUD } from './theme'
import { pixelText } from './text'

function fmt(n: number): string {
  if (n < 1000) return n.toFixed(n < 10 ? 1 : 0)
  const units = ['k', 'M', 'G', 'T']
  let u = -1
  do {
    n /= 1000
    u++
  } while (n >= 1000 && u < units.length - 1)
  return n.toFixed(1) + units[u]
}

// HUD permanent de la GameScene : miel, gelée, nectar, combo + feedbacks flottants.
export class Hud {
  private scene: Phaser.Scene
  private honeyText: Phaser.GameObjects.BitmapText
  private jellyText: Phaser.GameObjects.BitmapText
  private nectarText: Phaser.GameObjects.BitmapText
  private comboText: Phaser.GameObjects.BitmapText
  private nectarBar: Phaser.GameObjects.Rectangle
  private comboBar: Phaser.GameObjects.Rectangle

  constructor(scene: Phaser.Scene) {
    this.scene = scene

    this.honeyText = pixelText(scene, 12, 10, '', FONTS.sizeHoney, HEX.cream)
      .setScrollFactor(0)
      .setDepth(100)
    this.jellyText = pixelText(scene, 12, 50, '', FONTS.sizeJelly, HEX.jelly)
      .setScrollFactor(0)
      .setDepth(100)

    // Jauge nectar (haut-droite)
    scene.add
      .rectangle(WORLD.width - 132, 16, HUD.nectarBarWidth, 16, COLORS.bgDark, 0.6)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100)
    this.nectarBar = scene.add
      .rectangle(WORLD.width - 130, 18, 0, 12, COLORS.honey)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(101)
    this.nectarText = pixelText(scene, WORLD.width - 132, 34, '', FONTS.sizeSmall, HEX.cream)
      .setScrollFactor(0)
      .setDepth(101)

    // Jauge combo (bas-centre)
    const cx = WORLD.width / 2
    scene.add
      .rectangle(cx, WORLD.height - 26, HUD.comboBarWidth + 4, 18, COLORS.bgDark, 0.6)
      .setScrollFactor(0)
      .setDepth(100)
    this.comboBar = scene.add
      .rectangle(cx - HUD.comboBarWidth / 2, WORLD.height - 34, 0, 12, COLORS.honey)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(101)
    this.comboText = pixelText(scene, cx, WORLD.height - 52, '', FONTS.sizeCombo, HEX.cream)
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(101)
  }

  update(nectar: number, capacity: number, comboValue: number, comboMult: number): void {
    this.honeyText.setText(`${STR.honey}: ${fmt(gameState.honey)}`)
    this.jellyText.setText(`${STR.royalJelly}: ${fmt(gameState.royalJelly)}`)

    this.nectarText.setText(`${STR.nectar} ${Math.floor(nectar)}/${capacity}`)
    this.nectarBar.width = HUD.nectarBarWidth * Phaser.Math.Clamp(nectar / capacity, 0, 1)

    // Couleur combo : rouge (bas) → doré (haut).
    const norm = Phaser.Math.Clamp(comboValue / HUD.comboBarMax, 0, 1)
    this.comboText.setText(comboValue > 0 ? `${STR.combo} x${comboMult.toFixed(2)}` : '')
    this.comboBar.width = HUD.comboBarWidth * norm
    const low = Phaser.Display.Color.IntegerToColor(COLORS.comboLow)
    const high = Phaser.Display.Color.IntegerToColor(COLORS.comboHigh)
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(low, high, 100, norm * 100)
    this.comboBar.fillColor = Phaser.Display.Color.GetColor(c.r, c.g, c.b)
  }

  /** Texte flottant qui pop et remonte (ex "+5", "Parfait !"). */
  popText(x: number, y: number, text: string, color: string = HEX.cream): void {
    const t = pixelText(this.scene, x, y, text, FONTS.sizePop, color)
      .setOrigin(0.5, 0.5)
      .setDepth(120)
    this.scene.tweens.add({
      targets: t,
      y: y - HUD.popRise,
      alpha: 0,
      duration: HUD.popDuration,
      ease: 'Cubic.Out',
      onComplete: () => t.destroy(),
    })
  }
}
