import Phaser from 'phaser'
import { BitmapText } from 'phaser-pixui'
import { STR } from '../config/strings'
import { gameState } from '../systems/GameState'
import { WORLD } from '../config/game'
import { COLORS, HEX, FONTS, HUD } from './theme'
import { FONT_KEY } from '../gfx/font'
import { pixelText } from './text'
import { Ui, OriginX, OriginY } from './pixui'

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
// Les libellés sont posés via pixui (ancrage responsive aux coins de l'écran) et
// gardent notre bitmap font « monogram ». Les jauges restent de simples
// rectangles de scène (widgets à taille animée, plus directs en impératif).
export class Hud {
  private scene: Phaser.Scene
  private ui: Ui
  private honeyText: BitmapText
  private jellyText: BitmapText
  private nectarText: BitmapText
  private comboText: BitmapText
  private nectarBar: Phaser.GameObjects.Rectangle
  private comboBar: Phaser.GameObjects.Rectangle

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.ui = new Ui(scene)

    // Libellés ancrés (pixui).
    this.honeyText = this.ui.topLeft.bitmapText({
      font: FONT_KEY,
      size: FONTS.sizeHoney,
      text: '',
      tint: COLORS.cream,
      x: 12,
      y: 10,
    })
    this.jellyText = this.ui.topLeft.bitmapText({
      font: FONT_KEY,
      size: FONTS.sizeJelly,
      text: '',
      tint: COLORS.jelly,
      x: 12,
      y: 50,
    })
    this.nectarText = this.ui.topRight.bitmapText({
      font: FONT_KEY,
      size: FONTS.sizeSmall,
      text: '',
      tint: COLORS.cream,
      x: 12,
      y: 34,
      originX: OriginX.Right,
      originY: OriginY.Top,
    })
    this.comboText = this.ui.bottomCenter.bitmapText({
      font: FONT_KEY,
      size: FONTS.sizeCombo,
      text: '',
      tint: COLORS.cream,
      x: 0,
      y: 52,
      originX: OriginX.Center,
      originY: OriginY.Bottom,
    })

    this.ui.commit()

    // Les libellés doivent passer au-dessus des sprites de jeu (bee depth 50).
    for (const t of [this.honeyText, this.jellyText, this.nectarText, this.comboText]) {
      t.internal.setDepth(101)
    }

    // Jauge nectar (haut-droite).
    scene.add
      .rectangle(WORLD.width - 132, 16, HUD.nectarBarWidth, 16, COLORS.bgDark, 0.6)
      .setOrigin(0, 0)
      .setDepth(100)
    this.nectarBar = scene.add
      .rectangle(WORLD.width - 130, 18, 0, 12, COLORS.honey)
      .setOrigin(0, 0)
      .setDepth(101)

    // Jauge combo (bas-centre).
    const cx = WORLD.width / 2
    scene.add
      .rectangle(cx, WORLD.height - 26, HUD.comboBarWidth + 4, 18, COLORS.bgDark, 0.6)
      .setDepth(100)
    this.comboBar = scene.add
      .rectangle(cx - HUD.comboBarWidth / 2, WORLD.height - 34, 0, 12, COLORS.honey)
      .setOrigin(0, 0)
      .setDepth(101)
  }

  update(nectar: number, capacity: number, comboValue: number, comboMult: number): void {
    this.honeyText.text = `${STR.honey}: ${fmt(gameState.honey)}`
    this.jellyText.text = `${STR.royalJelly}: ${fmt(gameState.royalJelly)}`

    this.nectarText.text = `${STR.nectar} ${Math.floor(nectar)}/${capacity}`
    this.nectarBar.width = HUD.nectarBarWidth * Phaser.Math.Clamp(nectar / capacity, 0, 1)

    // Couleur combo : rouge (bas) → doré (haut).
    const norm = Phaser.Math.Clamp(comboValue / HUD.comboBarMax, 0, 1)
    this.comboText.text = comboValue > 0 ? `${STR.combo} x${comboMult.toFixed(2)}` : ''
    this.comboBar.width = HUD.comboBarWidth * norm
    const low = Phaser.Display.Color.IntegerToColor(COLORS.comboLow)
    const high = Phaser.Display.Color.IntegerToColor(COLORS.comboHigh)
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(low, high, 100, norm * 100)
    this.comboBar.fillColor = Phaser.Display.Color.GetColor(c.r, c.g, c.b)
  }

  /** Texte flottant qui pop et remonte (ex "+5", "Parfait !"). Transient : reste
   * en BitmapText de scène tweené (hors layout pixui). */
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
