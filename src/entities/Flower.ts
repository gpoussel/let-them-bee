import Phaser from 'phaser'
import { FLOWER } from '../config/balance'
import { FEEL } from '../config/feel'
import { TEX } from '../gfx/textures'

// Fleur avec cycle d'ouverture/fermeture en boucle. Butiner près du pic d'ouverture
// donne un bonus "Perfect". Après butinage, la fleur se recharge (cooldown).
export class Flower extends Phaser.GameObjects.Sprite {
  private cyclePhase: number // 0..1
  private cooldown = 0
  quality: number

  constructor(scene: Phaser.Scene, x: number, y: number, quality = 1) {
    super(scene, x, y, TEX.flowerClosed)
    scene.add.existing(this)
    this.setOrigin(0.5, 0.9)
    this.quality = quality
    this.cyclePhase = Math.random() // désynchronise les fleurs
  }

  get isReady(): boolean {
    return this.cooldown <= 0
  }

  /** Ouverture 0 (fermée) → 1 (pleinement ouverte), forme triangulaire sur le cycle. */
  get openness(): number {
    const p = this.cyclePhase
    return p < 0.5 ? p * 2 : (1 - p) * 2
  }

  get isPerfect(): boolean {
    return this.isReady && this.openness >= 1 - FLOWER.perfectWindow
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta)
    const dt = delta / 1000

    if (this.cooldown > 0) {
      this.cooldown -= dt
      this.setTexture(TEX.flowerClosed)
      this.setAlpha(0.5)
      return
    }
    this.setAlpha(1)

    this.cyclePhase = (this.cyclePhase + dt / FLOWER.openCycle) % 1

    const o = this.openness
    if (o < 0.34) this.setTexture(TEX.flowerClosed)
    else if (o < 0.85) this.setTexture(TEX.flowerHalf)
    else this.setTexture(TEX.flowerOpen)

    // Légère respiration.
    const s = 1 + o * FEEL.flowerBreath
    this.setScale(s)
  }

  /** Tente de butiner. Renvoie le nectar récolté (0 si pas prête), et si c'était Perfect. */
  forage(): { nectar: number; perfect: boolean } {
    if (!this.isReady || this.openness < 0.34) return { nectar: 0, perfect: false }
    const perfect = this.isPerfect
    let nectar = FLOWER.baseNectar * this.quality
    if (perfect) nectar *= FLOWER.perfectMultiplier
    this.cooldown = FLOWER.rechargeCooldown
    return { nectar, perfect }
  }
}
