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
  /**
   * Amplitude de la DÉRIVE, en multiple de `BEE.driftPx`. 0 = l'abeille va droit
   * où on la montre. Comme `lerpMult`, elle ne concerne que le PILOTAGE : la
   * scène la met à zéro hors enregistrement, sinon la relecture tremblerait
   * autour d'un trajet qu'elle est censée refaire au pixel.
   */
  driftMult = 0
  /** Horloge de la dérive, en secondes de vol piloté. */
  private driftTime = 0

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

    // La dérive déplace la CIBLE, pas l'abeille : le vol reste lissé, il vise
    // simplement à côté. C'est ce qui la fait flotter au lieu de vibrer.
    //
    // Elle est SURTOUT LATÉRALE et elle S'EMBALLE AVEC LA DISTANCE au pointeur.
    // Les deux vont ensemble et disent la même chose : une abeille qu'on envoie
    // loin part de travers et arrive n'importe où, alors qu'un pointeur posé
    // juste devant elle la tient. La montée est EXPONENTIELLE (driftPow), et
    // c'est le point : une croissance proportionnelle se corrige d'instinct,
    // celle-ci oblige à rapprocher le pointeur — c'est-à-dire à MENER l'abeille
    // au lieu de la montrer du doigt. Le plafond n'adoucit rien : sans lui la
    // cible sortirait du pré et l'abeille filerait tout droit.
    let tx = this.target.x
    let ty = this.target.y
    if (this.driftMult > 0) {
      this.driftTime += dt
      const a = this.driftTime * BEE.driftHzA * Math.PI * 2
      const b = this.driftTime * BEE.driftHzB * Math.PI * 2
      const toX = this.target.x - this.fx
      const toY = this.target.y - this.fy
      const reach = Math.hypot(toX, toY)
      const c = this.driftTime * BEE.driftHzC * Math.PI * 2
      const far = (reach / BEE.driftFullPx) ** BEE.driftPow
      const amp = Math.min(BEE.driftMaxPx, BEE.driftPx * this.driftMult * (BEE.driftNear + far))
      // Composante latérale : perpendiculaire à la course, donc un écart de cap
      // et non un tremblement. Elle domine, et c'est elle qu'on apprend à corriger.
      // La troisième sinusoïde, lente, est celle qui fait partir l'abeille en
      // vrille quand le pointeur est loin : à courte portée elle ne se voit pas,
      // à longue portée c'est elle qui commande le vol.
      const swerve = (Math.sin(a) + Math.sin(b * 1.7) * 0.5 + Math.sin(c) * 1.2) * amp
      const nx0 = reach > 1 ? -toY / reach : 0
      const ny0 = reach > 1 ? toX / reach : 0
      tx += nx0 * swerve + Math.sin(b) * amp * BEE.driftFloat
      ty += ny0 * swerve + Math.cos(a * 1.3) * amp * BEE.driftFloat
    }

    // Lissage exponentiel vers la cible (indépendant du framerate).
    const t = 1 - Math.exp(-BEE.lerp * this.lerpMult * dt)
    const nx = Phaser.Math.Linear(this.fx, tx, t)
    const ny = Phaser.Math.Linear(this.fy, ty, t)

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
