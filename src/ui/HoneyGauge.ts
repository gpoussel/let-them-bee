// La jauge de transformation, posée sur le toit de la ruche.
//
// C'est le seul endroit où se voit le second métier de la ruche : pendant qu'une
// butineuse refait son tour dehors, les ouvrières transforment dedans. Le nectar
// part par lots de 100 (la réserve tombe d'un coup, en haut de l'écran), la
// jauge se remplit de gauche à droite, et le miel apparaît juste au-dessus.
//
// Elle n'existe que s'il y a une ouvrière : avant l'alvéole « ouvrières », la
// ruche ne sait pas transformer, et une jauge morte ne dit rien à personne.
//
// Un clic la coupe et la relance : la transformation mord sur la réserve, et le
// joueur doit pouvoir économiser pour une alvéole de rang IV sans la voir se
// faire manger lot après lot.

import Phaser from 'phaser'
import { HONEY } from '../config/balance'
import { gameState } from '../systems/GameState'
import { handCursor } from './cursor'
import { HONEY_GAUGE, PALETTE } from './theme'

/** Profondeur : au-dessus des fleurs et de l'abeille, sous les textes flottants. */
const DEPTH = -20

export class HoneyGauge {
  private readonly g: Phaser.GameObjects.Graphics
  private readonly hit: Phaser.GameObjects.Zone
  /** Coin haut-gauche de la jauge. */
  private readonly x: number
  private readonly y: number

  constructor(scene: Phaser.Scene, hiveX: number, hiveTopY: number) {
    const { width, height, rise } = HONEY_GAUGE
    this.x = Math.round(hiveX - width / 2)
    this.y = Math.round(hiveTopY - rise - height)

    this.g = scene.add.graphics().setDepth(DEPTH)
    // La zone cliquable déborde la jauge : douze pixels de haut, ça ne se vise
    // pas à la souris quand l'abeille passe à côté.
    this.hit = scene.add
      .zone(this.x - 6, this.y - 8, width + 12, height + 16)
      .setOrigin(0, 0)
      .setDepth(DEPTH)
      // Pas `useHandCursor` : ça pose la main du navigateur, et le jeu a la
      // sienne, gravée. Une seule main à l'écran.
      .setInteractive()
    handCursor(this.hit)
    this.hit.on('pointerdown', () => gameState.setBrewing(!gameState.brewEnabled))
  }

  /** Haut de la jauge : c'est de là que sort le miel, donc là que ça s'annonce. */
  get topY(): number {
    return this.y
  }

  update(): void {
    const on = gameState.canBrew
    this.g.setVisible(on)
    this.hit.input!.enabled = on
    if (!on) return

    const { width, height } = HONEY_GAUGE
    const { x, y } = this
    // À l'arrêt (coupée, ou faute de nectar), la jauge reste dessinée mais
    // éteinte : la ruche sait transformer, elle ne transforme pas — ce n'est
    // pas pareil.
    const running = gameState.brewing
    const idle = !running && (!gameState.brewEnabled || gameState.nectar < HONEY.nectarPerBatch)

    this.g.clear()
    this.g.fillStyle(PALETTE.darkGreen, 0.85)
    this.g.fillRect(x, y, width, height)

    const fill = Math.round(width * (running ? gameState.brewProgress : 0))
    if (fill > 0) {
      this.g.fillStyle(PALETTE.amber, 1)
      this.g.fillRect(x, y, fill, height)
    }

    this.g.lineStyle(2, idle ? PALETTE.oliveBrown : PALETTE.lime, 1)
    this.g.strokeRect(x + 1, y + 1, width - 2, height - 2)
  }
}
