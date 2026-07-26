// Flèche de relance : le doigt que l'on pointe sur un bouton.
//
// Le jeu ne dit jamais deux fois la même chose. Une flèche n'apparaît que
// lorsque le joueur n'a AUCUN moyen de deviner le geste attendu — le tout
// premier trajet, la toute première alvéole — et disparaît dès qu'il l'a fait.
// Elle bouge, parce qu'une flèche immobile se confond avec un décor.
//
// Ce n'est PAS un composant pixui : elle est posée en objet de scène, comme les
// textes flottants du HUD. Le layout pixui recalcule la position d'un composant
// à chaque mutation, et écraserait donc l'animation.

import type Phaser from 'phaser'
import { TEX } from '../gfx/textures'
import { NUDGE, PALETTE } from './theme'

/** Direction dans laquelle la flèche pointe (la texture est bakée vers le bas). */
export type NudgeDir = 'down' | 'left'

export class Nudge {
  private readonly arrow: Phaser.GameObjects.Image

  constructor(scene: Phaser.Scene, x: number, y: number, dir: NudgeDir) {
    this.arrow = scene.add
      .image(x, y, TEX.arrow)
      .setDepth(NUDGE.depth)
      .setAngle(dir === 'left' ? 90 : 0)
      .setVisible(false)
    this.arrow.setTint(PALETTE.amber)

    // Le va-et-vient tourne en permanence, même flèche cachée : rien à
    // redémarrer quand elle réapparaît, et elle ne repart jamais d'un état figé.
    scene.tweens.add({
      targets: this.arrow,
      ...(dir === 'left' ? { x: x - NUDGE.bob } : { y: y - NUDGE.bob }),
      duration: NUDGE.bobMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    })
  }

  setVisible(value: boolean): void {
    this.arrow.setVisible(value)
  }
}
