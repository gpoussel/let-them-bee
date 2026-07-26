import Phaser from 'phaser'
import { TEX } from '../gfx/textures'
import { bloomFrame, budFrame } from '../gfx/flowers'
import type { Slot, SlotState } from '../systems/FlowerField'
import { PALETTE } from '../ui/theme'

// Vue d'un emplacement du pré : le pied, et la barre qui le voit se faner.
//
// Aucune logique ici — la fleur ne décide de rien. Son état est calculé par
// `FlowerField` à partir de l'horloge du tour (cf. le commentaire d'en-tête de
// ce fichier) ; la fleur ne fait que l'afficher. C'est ce qui garantit que deux
// tours identiques donnent exactement le même pré.

/** Largeur et hauteur de la barre de fanaison, en px monde. */
const BAR_W = 22
const BAR_H = 4
/**
 * Hauteur de la barre au-dessus de la base du pied.
 *
 * Un pied fait 16x32 points d'art (cf. gfx/flowers), soit 64 px à l'échelle 2,
 * et il est posé par sa base — mais la tuile est plus haute que son dessin : les
 * rangs supérieurs sont transparents, et la corolle ne commence qu'à ~46 px du
 * sol. Une barre calée sur le HAUT DE LA TUILE (70) flottait donc une vingtaine
 * de pixels au-dessus des pétales, sans propriétaire évident ; dans un pré
 * dense, elle se lisait comme la barre de la fleur d'à côté. On la cale sur le
 * haut du DESSIN, en laissant juste de quoi ne pas mordre les pétales.
 */
const BAR_RISE = 50

export class Flower extends Phaser.GameObjects.Sprite {
  private readonly barBg: Phaser.GameObjects.Rectangle
  private readonly barFill: Phaser.GameObjects.Rectangle

  constructor(scene: Phaser.Scene, slot: Slot, scale: number, depth: number) {
    super(scene, slot.x, slot.y, TEX.objects, budFrame(0))
    scene.add.existing(this)
    // Le pied est posé par sa base : c'est la tige qui touche le sol.
    this.setOrigin(0.5, 1).setDepth(depth)
    // L'échelle est fixée une fois pour toutes, et entière : ces sprites sont
    // du pixel art de 16 px. La moindre échelle fractionnaire — ou animée —
    // fait baver leurs pixels, qui n'ont alors plus tous la même taille.
    this.setScale(scale)

    const barY = slot.y - BAR_RISE
    this.barBg = scene.add
      .rectangle(slot.x, barY, BAR_W, BAR_H, PALETTE.darkGreen, 0.9)
      .setDepth(depth)
    this.barFill = scene.add
      .rectangle(slot.x - BAR_W / 2, barY, BAR_W, BAR_H, PALETTE.lime)
      .setOrigin(0, 0.5)
      .setDepth(depth)
  }

  /** Aligne l'affichage sur l'état calculé pour l'instant courant. */
  sync(state: SlotState): void {
    if (state.phase === 'gone') {
      this.setVisible(false)
      this.barBg.setVisible(false)
      this.barFill.setVisible(false)
      return
    }

    this.setVisible(true)

    if (state.phase === 'bud') {
      // La pousse sort de terre. On la révèle par le bas en rognant le sprite
      // rang de pixels par rang de pixels : elle grandit vraiment, au lieu
      // d'être un dessin entier que l'on gonflerait.
      this.setFrame(budFrame(state.species))
      const h = this.frame.height
      const shown = Math.max(2, Math.round(h * (0.25 + 0.75 * state.growth)))
      this.setCrop(0, h - shown, this.frame.width, shown)
      this.setAlpha(0.8)
      this.barBg.setVisible(false)
      this.barFill.setVisible(false)
      return
    }

    // Corolle ouverte : elle pâlit à mesure qu'elle se fane, et sa barre se
    // vide. Le bon moment pour la butiner se lit d'un coup d'œil.
    this.setFrame(bloomFrame(state.species))
    this.isCropped = false
    this.setAlpha(0.65 + 0.35 * state.freshness)

    this.barBg.setVisible(true)
    this.barFill.setVisible(true)
    this.barFill.setDisplaySize(Math.max(1, BAR_W * state.freshness), BAR_H)
    // Verte tant qu'elle paie plein tarif, ambre quand elle s'épuise.
    const low = Phaser.Display.Color.IntegerToColor(PALETTE.amber)
    const high = Phaser.Display.Color.IntegerToColor(PALETTE.lime)
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(low, high, 100, state.freshness * 100)
    this.barFill.fillColor = Phaser.Display.Color.GetColor(c.r, c.g, c.b)
  }
}
