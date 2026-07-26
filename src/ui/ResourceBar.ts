// Barre de ressources, en haut de l'écran de jeu.
//
// Trois réserves lues d'un coup d'œil : le nectar que porte la butineuse, le
// miel de la ruche, la gelée royale. Rien qu'une icône et un nombre — le nom et
// le rôle de chaque ressource sont donnés au survol (cf. Tooltips).

import type Phaser from 'phaser'
import type { BitmapText, Clickable, ComponentFactory, Image } from 'phaser-pixui'
import { RESOURCE_STR } from '../config/strings'
import { FONT_KEY } from '../gfx/font'
import { TEX } from '../gfx/textures'
import { gameState } from '../systems/GameState'
import { fmtFine } from './format'
import { Nudge } from './Nudge'
import { handCursor, ninePanel, OriginX, OriginY, setText, UI9 } from './pixui'
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

export interface ResourceBarOpts {
  /** Clic sur l'étoile : ouvrir la lignée. C'est une SCÈNE, pas un panel d'ici. */
  onOpenLineage: () => void
}

/** Période du battement de l'étoile quand un nœud est payable, en ms. */
const STAR_PULSE_MS = 900

/** Interpolation linéaire entre deux couleurs 0xrrggbb. */
function mix(a: number, b: number, t: number): number {
  const ch = (shift: number) =>
    Math.round(((a >> shift) & 0xff) * (1 - t) + ((b >> shift) & 0xff) * t) & 0xff
  return (ch(16) << 16) | (ch(8) << 8) | ch(0)
}

export class ResourceBar {
  private readonly scene: Phaser.Scene
  private readonly values: BitmapText[] = []
  /** Porte de la lignée, à droite de la gelée royale, et la flèche qui la désigne. */
  private readonly star: Image
  private readonly starHit: Clickable
  private readonly nudge: Nudge

  constructor(scene: Phaser.Scene, f: ComponentFactory, tips: Tooltips, o: ResourceBarOpts) {
    this.scene = scene
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

    // L'étoile se pose JUSTE APRÈS la dernière réserve, hors de sa zone de
    // survol : posée dedans, elle serait couverte par l'infobulle de la gelée
    // royale et ne se laisserait jamais cliquer.
    const starX = first + SLOTS.length * slotW + 6
    this.star = f.image({
      ...anchor,
      texture: TEX.iconStar,
      frame: '__BASE',
      tint: PALETTE.amber,
      x: starX,
      y: midY - ICON / 2,
    })
    this.starHit = f.clickable({
      ...anchor,
      x: starX - 4,
      y: y + 4,
      width: ICON + 8,
      height: h - 8,
      onClick: () => {
        o.onOpenLineage()
      },
    })
    handCursor(this.starHit.events)
    this.nudge = new Nudge(scene, starX + ICON + 20, midY, 'left')
  }

  update(): void {
    // Le nectar affiché est celui de la RÉSERVE, pas celui que porte l'abeille :
    // c'est lui qu'on dépense dans le rayon, et lui qui sature.
    setText(this.values[0], `${Math.floor(gameState.nectar)}/${gameState.nectarCapacity}`)
    setText(this.values[1], fmtFine(gameState.honey))
    setText(this.values[2], fmtFine(gameState.royalJelly))

    // L'étoile n'existe qu'à partir du moment où la lignée a quelque chose à
    // dire — et elle ne disparaît plus une fois la première reine partie : un
    // joueur qui a essaimé doit pouvoir relire son arbre à tout moment.
    const offer = gameState.lineageHasOffer
    const known = offer || gameState.queens > 0 || gameState.lineage.size > 0
    this.star.visible = known
    this.starHit.visible = known
    if (offer) {
      const phase = (this.scene.time.now % STAR_PULSE_MS) / STAR_PULSE_MS
      const t = 0.5 - Math.cos(phase * Math.PI * 2) / 2
      this.star.tint = mix(COLORS.cream, PALETTE.amber, t)
    } else {
      this.star.tint = PALETTE.oliveBrown
    }
    // La flèche ne désigne que ce qui est payable ici et maintenant : une étoile
    // éteinte n'attend rien du joueur.
    this.nudge.setVisible(offer)
  }
}
