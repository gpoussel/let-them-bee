import Phaser from 'phaser'
import { BEE } from '../config/balance'
import { FEEL } from '../config/feel'
import { TEX } from '../gfx/textures'

// Abeille pilotée à la souris avec inertie. Le corps se déplace vers le pointeur
// via un lissage exponentiel ; les ailes battent en boucle ; l'abeille s'oriente
// vers sa direction de vol.
export class Bee extends Phaser.GameObjects.Sprite {
  private target = new Phaser.Math.Vector2()
  private flapTimer = 0
  private flapped = false

  nectar = 0
  nectarCapacity = BEE.nectarCapacity
  speedMult = 1
  radiusMult = 1

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEX.bee)
    scene.add.existing(this)
    this.setOrigin(0.5, 0.5)
    this.target.set(x, y)
  }

  get forageRadius(): number {
    return BEE.forageRadius * this.radiusMult
  }

  setTarget(x: number, y: number): void {
    this.target.set(x, y)
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta)
    const dt = delta / 1000

    // Lissage exponentiel vers la cible (indépendant du framerate).
    const t = 1 - Math.exp(-BEE.lerp * dt)
    const nx = Phaser.Math.Linear(this.x, this.target.x, t)
    const ny = Phaser.Math.Linear(this.y, this.target.y, t)

    // Clamp de la vitesse max.
    const maxStep = BEE.maxSpeed * this.speedMult * dt
    let dx = nx - this.x
    let dy = ny - this.y
    const dist = Math.hypot(dx, dy)
    if (dist > maxStep && dist > 0) {
      dx = (dx / dist) * maxStep
      dy = (dy / dist) * maxStep
    }
    this.x += dx
    this.y += dy

    // Orientation vers la direction de vol (le sprite pointe vers le haut → +90°).
    if (dist > 0.5) {
      this.rotation = Math.atan2(dy, dx) + Math.PI / 2
    }

    // Battement d'ailes.
    this.flapTimer += delta
    if (this.flapTimer > FEEL.wingFlapMs) {
      this.flapTimer = 0
      this.flapped = !this.flapped
      this.setTexture(this.flapped ? TEX.beeFlap : TEX.bee)
    }
  }
}
