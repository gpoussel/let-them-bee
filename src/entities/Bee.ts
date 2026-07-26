import Phaser from 'phaser'
import { BEE } from '../config/balance'
import { FEEL } from '../config/feel'
import { TEX } from '../gfx/textures'

// Abeille pilotée à la souris avec inertie. Le corps se déplace vers le pointeur
// via un lissage exponentiel ; les ailes battent en boucle ; l'abeille s'oriente
// vers sa direction de vol.
/**
 * Côté d'un pixel d'art de l'abeille, en points d'écran (cf. gfx/textures).
 * Le sprite est POSÉ sur cette grille : à une position fractionnaire, ses
 * pixels tombent à cheval sur deux points et la bestiole grésille.
 */
const GRID = 2
const snap = (v: number): number => Math.round(v / GRID) * GRID

/**
 * Nombre d'orientations distinctes. Une rotation libre rééchantillonne le
 * dessin en continu ; seize caps suffisent à lire la direction du vol tout en
 * laissant l'image tranquille entre deux virages.
 */
const HEADINGS = 16
const STEP = (Math.PI * 2) / HEADINGS

export class Bee extends Phaser.GameObjects.Sprite {
  private target = new Phaser.Math.Vector2()
  /**
   * Position réelle, en flottant. `x`/`y` n'en sont que l'arrondi à la grille :
   * cumuler le vol sur des coordonnées déjà arrondies perdrait tous les
   * déplacements plus courts qu'un pixel, et l'abeille resterait plantée.
   */
  private fx: number
  private fy: number
  private flapTimer = 0
  private flapped = false

  /** Nectar porté sur le tour en cours. Sans plafond : la ruche seule en a un. */
  nectar = 0
  speedMult = 1
  radiusMult = 1
  /**
   * Multiplicateur du lissage (cf. `BEE.lerp`), relevé par la lignée
   * `steadyWings`. PLUS GRAND = moins d'inertie. Il n'agit que sur le PILOTAGE :
   * la relecture d'un trajet passe par `moveTo`, qui ne lisse rien.
   */
  lerpMult = 1

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, snap(x), snap(y), TEX.bee)
    scene.add.existing(this)
    this.setOrigin(0.5, 0.5)
    this.fx = x
    this.fy = y
    this.target.set(x, y)
  }

  /** Oriente l'abeille vers son déplacement, au cap le plus proche. */
  private face(dx: number, dy: number): void {
    const angle = Math.atan2(dy, dx) + Math.PI / 2
    this.rotation = Math.round(angle / STEP) * STEP
  }

  get forageRadius(): number {
    return BEE.forageRadius * this.radiusMult
  }

  setTarget(x: number, y: number): void {
    this.target.set(x, y)
  }

  /**
   * Place l'abeille exactement sur un point, en la tournant vers son
   * déplacement. Sert à la RELECTURE d'un trajet : l'inertie du pilotage
   * couperait les virages et lui ferait manquer les fleurs qu'elle visait.
   * La cible est alignée sur la position, ce qui neutralise le lissage.
   */
  moveTo(x: number, y: number): void {
    const dx = x - this.fx
    const dy = y - this.fy
    if (Math.hypot(dx, dy) > 0.5) this.face(dx, dy)
    this.fx = x
    this.fy = y
    this.setPosition(snap(x), snap(y))
    this.target.set(x, y)
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta)
    const dt = delta / 1000

    // Lissage exponentiel vers la cible (indépendant du framerate).
    const t = 1 - Math.exp(-BEE.lerp * this.lerpMult * dt)
    const nx = Phaser.Math.Linear(this.fx, this.target.x, t)
    const ny = Phaser.Math.Linear(this.fy, this.target.y, t)

    // Clamp de la vitesse max.
    const maxStep = BEE.maxSpeed * this.speedMult * dt
    let dx = nx - this.fx
    let dy = ny - this.fy
    const dist = Math.hypot(dx, dy)
    if (dist > maxStep && dist > 0) {
      dx = (dx / dist) * maxStep
      dy = (dy / dist) * maxStep
    }
    this.fx += dx
    this.fy += dy
    this.setPosition(snap(this.fx), snap(this.fy))

    // Orientation vers la direction de vol (le sprite pointe vers le haut → +90°).
    if (dist > 0.5) this.face(dx, dy)

    // Battement d'ailes.
    this.flapTimer += delta
    if (this.flapTimer > FEEL.wingFlapMs) {
      this.flapTimer = 0
      this.flapped = !this.flapped
      this.setTexture(this.flapped ? TEX.beeFlap : TEX.bee)
    }
  }
}
