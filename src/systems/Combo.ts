import { COMBO } from '../config/balance'

// Gère le compteur de combo et sa décroissance temporelle.
export class Combo {
  value = 0
  private timeSinceForage = 0
  private decayAccumulator = 0
  decaySlow = 1 // < 1 ralentit la décroissance (upgrade Mémoire)

  get multiplier(): number {
    return 1 + this.value * COMBO.multiplierPerPoint
  }

  add(perfect: boolean): void {
    this.value += perfect ? COMBO.perPerfect : COMBO.perFlower
    this.timeSinceForage = 0
    this.decayAccumulator = 0
  }

  update(dt: number): void {
    if (this.value <= 0) return
    this.timeSinceForage += dt
    if (this.timeSinceForage < COMBO.decayDelay) return

    this.decayAccumulator += dt
    const interval = COMBO.decayInterval / this.decaySlow
    while (this.decayAccumulator >= interval && this.value > 0) {
      this.decayAccumulator -= interval
      this.value -= 1
    }
  }

  reset(): void {
    this.value = 0
    this.timeSinceForage = 0
    this.decayAccumulator = 0
  }
}
