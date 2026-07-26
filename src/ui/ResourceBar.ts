// Barre de ressources, en haut de l'écran de jeu.
//
// Trois réserves lues d'un coup d'œil : le nectar que porte la butineuse, le
// miel de la ruche, la gelée royale. Rien qu'une icône et un nombre — le nom et
// le rôle de chaque ressource sont donnés au survol (cf. Tooltips).

import type { BitmapText, ComponentFactory } from 'phaser-pixui'
import { RESOURCE_STR } from '../config/strings'
import { FONT_KEY } from '../gfx/font'
import { TEX } from '../gfx/textures'
import { gameState } from '../systems/GameState'
import { fmtFine } from './format'
import { ninePanel, OriginX, OriginY, setText, UI9 } from './pixui'
import { COLORS, FONTS, PALETTE, PANEL_TINT, SCREEN } from './theme'
import type { Tooltips } from './tooltip'

/** Côté d'une icône de ressource (bakée à sa taille d'affichage). */
const ICON = 32
/** Largeur d'une réserve : icône, écart, et de quoi loger « 1234/20 ». */
const SLOT_W = 200

interface Slot {
  key: keyof typeof RESOURCE_STR
  texture: string
  tint: number
}

const SLOTS: readonly Slot[] = [
  { key: 'nectar', texture: TEX.iconNectar, tint: PALETTE.lime },
  { key: 'honey', texture: TEX.iconHoney, tint: PALETTE.amber },
  { key: 'royalJelly', texture: TEX.iconJelly, tint: COLORS.cream },
]

export class ResourceBar {
  private readonly values: BitmapText[] = []

  constructor(f: ComponentFactory, tips: Tooltips) {
    const { x, y, w, h } = SCREEN.bar
    const anchor = { originX: OriginX.Left, originY: OriginY.Top } as const

    ninePanel(f, { ...anchor, x, y, width: w, height: h, skin: UI9.insetDark, tint: PANEL_TINT })

    // Les trois réserves se partagent la barre à parts égales, mais groupées au
    // centre : étalées sur toute la largeur, les nombres se perdaient.
    const slotW = SLOT_W
    const first = x + (w - slotW * SLOTS.length) / 2
    const midY = y + h / 2

    SLOTS.forEach((slot, i) => {
      const sx = first + i * slotW

      f.image({
        ...anchor,
        texture: slot.texture,
        frame: '__BASE',
        tint: slot.tint,
        x: sx,
        y: midY - ICON / 2,
      })
      this.values.push(
        f.bitmapText({
          ...anchor,
          font: FONT_KEY,
          size: FONTS.sizeSmall,
          text: '',
          tint: COLORS.cream,
          x: sx + ICON + 12,
          y: midY - FONTS.sizeSmall / 2,
        }),
      )

      const label = RESOURCE_STR[slot.key]
      tips.hotspot(f, {
        x: sx - 8,
        y: y + 4,
        width: slotW,
        height: h - 8,
        title: label.name,
        text: label.tip,
      })
    })
  }

  update(): void {
    // Le nectar affiché est celui de la RÉSERVE, pas celui que porte l'abeille :
    // c'est lui qu'on dépense dans le rayon, et lui qui sature.
    setText(this.values[0], `${Math.floor(gameState.nectar)}/${gameState.nectarCapacity}`)
    setText(this.values[1], fmtFine(gameState.honey))
    setText(this.values[2], fmtFine(gameState.royalJelly))
  }
}
