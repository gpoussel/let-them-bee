// Accès au rayon, en bas de la colonne de gauche.
//
// Ce coin de l'écran affichait jusqu'ici un bilan que personne ne lisait
// (production passive, meilleur score, reines) : trois nombres inertes sur un
// tiers de colonne. Il ne reste qu'une porte — la ruche, et ce qu'il reste à
// bâtir autour. Le bilan reviendra quand il aura quelque chose à dire.

import type Phaser from 'phaser'
import type { BitmapText, Clickable, ComponentFactory, Image } from 'phaser-pixui'
import { STR } from '../config/strings'
import { COMB_TOTAL } from '../config/upgrades'
import { FONT_KEY } from '../gfx/font'
import { TEX } from '../gfx/textures'
import { gameState } from '../systems/GameState'
import { Nudge } from './Nudge'
import { handCursor, ninePanel, OriginX, OriginY, setText, UI9 } from './pixui'
import { COLORS, FONTS, PALETTE, PANEL_TINT, SCREEN } from './theme'

/** Côté de la ruche bakée (32 points d'art à 2 px). */
const HIVE_SIZE = 64
/** Période du battement de la ruche quand une alvéole est payable, en ms. */
const PULSE_MS = 900

/** Interpolation linéaire entre deux couleurs 0xrrggbb. */
function mix(a: number, b: number, t: number): number {
  const ch = (shift: number) =>
    Math.round(((a >> shift) & 0xff) * (1 - t) + ((b >> shift) & 0xff) * t) & 0xff
  return (ch(16) << 16) | (ch(8) << 8) | ch(0)
}

export interface CombButtonOpts {
  onOpen: () => void
}

export class CombButton {
  private readonly scene: Phaser.Scene
  private readonly hive: Image
  private readonly progress: BitmapText
  private readonly hit: Clickable
  /** Annonce de la toute première alvéole payable, et la flèche qui la désigne. */
  private readonly offer: BitmapText
  private readonly nudge: Nudge

  constructor(scene: Phaser.Scene, f: ComponentFactory, o: CombButtonOpts) {
    this.scene = scene
    const { x, y, w, h } = SCREEN.tree
    const anchor = { originX: OriginX.Left, originY: OriginY.Top } as const

    ninePanel(f, { ...anchor, x, y, width: w, height: h, skin: UI9.insetDark, tint: PANEL_TINT })

    // La ruche elle-même sert d'icône : c'est le bâtiment qu'on va agrandir, pas
    // une métaphore de plus. Elle est bakée à sa taille d'affichage — une image
    // pixui rééchelonnée après coup baverait sur ses diagonales.
    this.hive = f.image({
      texture: TEX.hive,
      frame: '__BASE',
      x: x + 12 + HIVE_SIZE / 2,
      y: y + h / 2,
      originX: OriginX.Center,
      originY: OriginY.Center,
    })

    const textX = x + 20 + HIVE_SIZE
    f.bitmapText({
      ...anchor,
      font: FONT_KEY,
      size: FONTS.sizeSmall,
      text: STR.comb,
      tint: PALETTE.amber,
      x: textX,
      y: y + 18,
    })
    this.progress = f.bitmapText({
      ...anchor,
      font: FONT_KEY,
      size: FONTS.sizeHint,
      text: '',
      tint: COLORS.cream,
      x: textX,
      y: y + 48,
    })

    // Le battement de la ruche (cf. update) suffit à qui sait déjà que le rayon
    // s'ouvre ; il ne dit rien à qui l'ignore encore. Pour la PREMIÈRE alvéole
    // seulement, on le dit avec des mots, et une flèche pointe la ruche depuis
    // la droite du cadre — le seul espace libre de ce coin d'écran.
    this.offer = f.bitmapText({
      ...anchor,
      font: FONT_KEY,
      size: FONTS.sizeHint,
      text: STR.combOffer,
      tint: PALETTE.amber,
      x: textX,
      y: y + 64,
    })
    // Calée en BAS à droite, pas à mi-hauteur : le titre « The Comb » court
    // jusqu'au bord droit du cadre, et une flèche posée à sa hauteur le percute
    // au lieu de le désigner.
    this.nudge = new Nudge(scene, x + w - 26, y + h - 22, 'left')

    this.hit = f.clickable({
      ...anchor,
      x,
      y,
      width: w,
      height: h,
      onClick: () => {
        o.onOpen()
      },
    })
    handCursor(this.hit.events)
  }

  update(): void {
    // Une alvéole visible ET payable : le rayon respire pour le dire. Sinon il
    // reste éteint — la ruche n'a pas à réclamer l'attention en permanence.
    if (gameState.combHasOffer) {
      const phase = (this.scene.time.now % PULSE_MS) / PULSE_MS
      const t = 0.5 - Math.cos(phase * Math.PI * 2) / 2
      this.hive.tint = mix(COLORS.cream, PALETTE.lime, t)
    } else {
      this.hive.tint = PALETTE.oliveBrown
    }
    setText(this.progress, `${gameState.comb.size}/${COMB_TOTAL}`)

    // La relance ne vise QUE le premier achat : dès qu'une alvéole est bâtie, le
    // joueur sait où est le rayon, et le battement de la ruche reprend seul le
    // relais pour toutes les suivantes.
    const firstOffer = gameState.combHasOffer && gameState.comb.size === 0
    this.offer.visible = firstOffer
    this.nudge.setVisible(firstOffer)
  }
}
