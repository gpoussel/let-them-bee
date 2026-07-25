import Phaser from 'phaser'
import { WORLD } from '../config/game'
import { FLOWER } from '../config/balance'
import { FEEL } from '../config/feel'
import { STR } from '../config/strings'
import { COLORS, HEX, FONTS } from '../ui/theme'
import { pixelText } from '../ui/text'
import { TEX } from '../gfx/textures'
import { Bee } from '../entities/Bee'
import { Flower } from '../entities/Flower'
import { Combo } from '../systems/Combo'
import { gameState } from '../systems/GameState'
import { Hud } from '../ui/Hud'

// Scène de jeu principale : le mini-jeu de vol + la boucle économique.
export class GameScene extends Phaser.Scene {
  private bee!: Bee
  private flowers: Flower[] = []
  private hive!: Phaser.GameObjects.Sprite
  private combo = new Combo()
  private hud!: Hud
  private autosaveTimer = 0

  constructor() {
    super('Game')
  }

  create(): void {
    const { width, height } = WORLD
    this.drawField()

    // Ruche (zone de dépôt) dans un coin.
    this.hive = this.add.sprite(width - 70, height - 90, TEX.hive).setScale(2)
    pixelText(this, this.hive.x, this.hive.y + 40, STR.hive, FONTS.sizeSmall, HEX.cream).setOrigin(
      0.5,
    )

    // Fleurs disséminées (en évitant la ruche).
    for (let i = 0; i < FLOWER.count; i++) {
      const x = Phaser.Math.Between(40, width - 40)
      const y = Phaser.Math.Between(60, height - 60)
      if (Phaser.Math.Distance.Between(x, y, this.hive.x, this.hive.y) < 90) continue
      const quality = Phaser.Math.RND.pick([1, 1, 1, 2, 3])
      this.flowers.push(new Flower(this, x, y, quality).setScale(2) as Flower)
    }

    // Abeille.
    this.bee = new Bee(this, width / 2, height / 2)
    this.bee.setScale(2).setDepth(50)

    // HUD.
    this.hud = new Hud(this)

    // Contrôle souris.
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.bee.setTarget(p.worldX, p.worldY))

    pixelText(this, width / 2, 4, STR.controlsHint, FONTS.sizeHint, HEX.cream)
      .setOrigin(0.5, 0)
      .setAlpha(0.6)
      .setDepth(100)
  }

  private drawField(): void {
    const { width, height } = WORLD
    const tile = 32
    const g = this.add.graphics().setDepth(-10)
    for (let y = 0; y < height; y += tile) {
      for (let x = 0; x < width; x += tile) {
        const checker = ((x / tile) + (y / tile)) % 2 === 0
        g.fillStyle(checker ? COLORS.grassA : COLORS.grassB, 1)
        g.fillRect(x, y, tile, tile)
      }
    }
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000

    this.combo.update(dt)
    gameState.tickWorkers(dt)

    // Détection de butinage : la fleur la plus proche dans le rayon.
    for (const f of this.flowers) {
      if (!f.isReady) continue
      const d = Phaser.Math.Distance.Between(this.bee.x, this.bee.y, f.x, f.y)
      if (d > this.bee.forageRadius + 10) continue
      this.tryForage(f)
    }

    // Dépôt automatique quand l'abeille touche la ruche.
    const dHive = Phaser.Math.Distance.Between(this.bee.x, this.bee.y, this.hive.x, this.hive.y)
    if (dHive < 50 && this.bee.nectar > 0) this.deposit()

    this.hud.update(this.bee.nectar, this.bee.nectarCapacity, this.combo.value, this.combo.multiplier)

    this.autosaveTimer += delta
    if (this.autosaveTimer >= FEEL.autosaveMs) {
      this.autosaveTimer = 0
      gameState.save()
    }
  }

  private tryForage(f: Flower): void {
    if (this.bee.nectar >= this.bee.nectarCapacity) return
    const { nectar, perfect } = f.forage()
    if (nectar <= 0) return

    this.combo.add(perfect)
    this.bee.nectar = Math.min(this.bee.nectarCapacity, this.bee.nectar + nectar)

    this.hud.popText(
      f.x,
      f.y - 20,
      perfect ? `${STR.perfect} +${nectar}` : `+${nectar}`,
      perfect ? HEX.perfect : HEX.cream,
    )
    this.spawnPollen(f.x, f.y)
    this.tweens.add({ targets: f, scaleX: 2.3, scaleY: 2.3, duration: 90, yoyo: true })
  }

  private deposit(): void {
    const gained = this.bee.nectar * this.combo.multiplier
    gameState.addHoney(gained)
    this.hud.popText(this.hive.x, this.hive.y - 40, `+${Math.floor(gained)} ${STR.honey}`, HEX.honey)
    this.bee.nectar = 0
  }

  private spawnPollen(x: number, y: number): void {
    for (let i = 0; i < 5; i++) {
      const p = this.add.image(x, y, TEX.pollen).setDepth(40)
      this.tweens.add({
        targets: p,
        x: x + Phaser.Math.Between(-24, 24),
        y: y + Phaser.Math.Between(-24, 24),
        alpha: 0,
        duration: 500,
        onComplete: () => p.destroy(),
      })
    }
  }
}
