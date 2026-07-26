// Infobulles de survol.
//
// Une infobulle est posée en deux temps : la ZONE de survol est déclarée en même
// temps que le composant qu'elle décrit (`hotspot`), la BULLE n'est construite
// qu'à la fin (`build`), une fois tous les panneaux en place — pixui rend une
// liste plate dans l'ordre de création, et la bulle doit passer par-dessus tout.

import Phaser from 'phaser'
import type { Clickable, ComponentFactory } from 'phaser-pixui'
import { FONT_KEY } from '../gfx/font'
import { WORLD } from '../config/game'
import { COLORS, FONTS } from './theme'
import { ninePanel, OriginX, OriginY, UI9, type Ui } from './pixui'

/** Longueur maximale d'une ligne d'infobulle, en caractères. */
const WRAP = 42
const PAD_X = 12
// La fonte ne réserve pas de jambage sous la dernière ligne : sans ce demi-pas
// de marge en plus, la descendante d'un « y » final touchait le cadre.
const PAD_Y = 8
const PAD_BOTTOM = 14
/** Écart entre le bord de la zone survolée et la bulle. */
const GAP = 8

/** Coupe le texte en lignes d'au plus `WRAP` caractères, sans casser les mots. */
export function wrap(text: string, max = WRAP): string {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    if (line.length > 0 && line.length + 1 + word.length > max) {
      lines.push(line)
      line = word
    } else {
      line = line.length > 0 ? `${line} ${word}` : word
    }
  }
  if (line.length > 0) lines.push(line)
  return lines.join('\n')
}

export interface HotspotOpts {
  /** Zone de survol, en coordonnées absolues du monde (coin haut-gauche). */
  x: number
  y: number
  width: number
  height: number
  /** Titre (une ligne, ambre) puis corps du texte. */
  title: string
  text: string
  /**
   * Bord de la zone auquel accrocher la bulle. `below` la pose sous la zone,
   * `right` à sa droite : à choisir selon la place disponible à l'écran.
   */
  side?: 'below' | 'right'
}

interface Pending extends HotspotOpts {
  hovered: () => boolean
}

/**
 * Couche d'infobulles d'une scène. Usage :
 *   const tips = new Tooltips(ui)
 *   tips.hotspot(layer, { ... })   // à chaque zone décrite
 *   tips.build()                   // APRÈS tous les panneaux
 *   ui.commit()
 */
export class Tooltips {
  private readonly pending: Pending[] = []
  private readonly bubbles: { show: (on: boolean) => void }[] = []

  constructor(private readonly ui: Ui) {}

  /**
   * Déclare une zone de survol. À appeler AVANT `build()`. La zone est
   * renvoyée : masquer une ligne d'interface, c'est aussi masquer sa zone
   * (`hit.visible = false`), sinon son infobulle survivrait à la ligne.
   */
  hotspot(f: ComponentFactory, o: HotspotOpts): Clickable {
    const hit = f.clickable({
      x: o.x,
      y: o.y,
      width: o.width,
      height: o.height,
      originX: OriginX.Left,
      originY: OriginY.Top,
    })
    this.pending.push({ ...o, hovered: () => hit.visible && hit.hovered })
    return hit
  }

  /** Construit les bulles (masquées). À appeler APRÈS tous les panneaux. */
  build(): void {
    for (const tip of this.pending) this.bubbles.push(this.buildBubble(tip))
  }

  /** Affiche la bulle de la zone survolée, s'il y en a une. À appeler chaque frame. */
  update(): void {
    this.pending.forEach((tip, i) => {
      this.bubbles[i].show(tip.hovered())
    })
  }

  private buildBubble(tip: Pending): { show: (on: boolean) => void } {
    const body = wrap(tip.text)
    const size = FONTS.sizeHint
    const measure = this.ui.scene.make.bitmapText(
      { font: FONT_KEY, size, text: `${tip.title}\n${body}` },
      false,
    )
    const w = measure.width + PAD_X * 2
    const h = measure.height + PAD_Y + PAD_BOTTOM
    const lineH = measure.height / (body.split('\n').length + 1)
    measure.destroy()

    // La bulle reste dans l'écran : elle glisse le long du bord si elle déborde.
    const anchorX = tip.side === 'right' ? tip.x + tip.width + GAP : tip.x
    const anchorY = tip.side === 'right' ? tip.y : tip.y + tip.height + GAP
    const x = Phaser.Math.Clamp(anchorX, 4, WORLD.width - w - 4)
    const y = Phaser.Math.Clamp(anchorY, 4, WORLD.height - h - 4)

    const panel = this.ui.panel({
      x: 0,
      y: 0,
      width: WORLD.width,
      height: WORLD.height,
      originX: OriginX.Left,
      originY: OriginY.Top,
    })
    const f = panel.topLeft
    ninePanel(f, {
      x,
      y,
      width: w,
      height: h,
      skin: UI9.insetDark,
      originX: OriginX.Left,
      originY: OriginY.Top,
    })
    f.bitmapText({
      font: FONT_KEY,
      size,
      text: tip.title,
      tint: COLORS.honey,
      x: x + PAD_X,
      y: y + PAD_Y,
      originX: OriginX.Left,
      originY: OriginY.Top,
    })
    f.bitmapText({
      font: FONT_KEY,
      size,
      text: body,
      tint: COLORS.cream,
      x: x + PAD_X,
      y: y + PAD_Y + lineH,
      originX: OriginX.Left,
      originY: OriginY.Top,
    })

    let shown = false
    panel.visible = false
    return {
      show: (on: boolean) => {
        if (on === shown) return
        shown = on
        if (on) panel.bringToTop()
        panel.visible = on
      },
    }
  }
}
