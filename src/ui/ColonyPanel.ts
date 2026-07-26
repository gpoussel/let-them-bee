// Effectifs de la ruche, colonne de gauche de l'écran de jeu.
//
// On ne montre au joueur que les castes qu'il possède ET LA SUIVANTE, celle
// qu'il lui reste à débloquer (cf. `GameState.visibleKinds`) : au premier
// lancement, la butineuse et l'ouvrière — les guerrières n'existent pas encore
// à ses yeux. Les lignes sont toutes construites d'avance et se dévoilent au
// fil des déblocages.

import type { BitmapText, Clickable, ComponentFactory, Image } from 'phaser-pixui'
import { BEE_KINDS, type BeeKindId } from '../config/balance'
import { BEE_STR, STR } from '../config/strings'
import { FONT_KEY } from '../gfx/font'
import { TEX } from '../gfx/textures'
import { gameState } from '../systems/GameState'
import { fmtCount } from './format'
import { button, type ButtonHandle, ninePanel, OriginX, OriginY, setText, UI9 } from './pixui'
import { BEE_TINT, COLORS, FONTS, PALETTE, PANEL_PAD, PANEL_TINT, SCREEN } from './theme'
import type { Tooltips } from './tooltip'

/** Côté d'une icône de caste. */
const ICON = 32
/** Hauteur d'une ligne d'effectif. */
const ROW_H = 60
/** Largeur de l'interrupteur des ouvrières : juste de quoi tenir ses libellés. */
const REST_W = 56
/** Décalage du « Zzz » après l'effectif, assez large pour un compte à trois chiffres. */
const ZZZ_X = 36
/** Points qui suivent le « Zzz », et la période de leur souffle en ms. */
const ZZZ_DOTS = 3
const ZZZ_MS = 1800

interface Row {
  id: BeeKindId
  icon: Image
  name: BitmapText
  count: BitmapText
  hit: Clickable
}

export class ColonyPanel {
  private readonly rows: Row[] = []
  /** Interrupteur des ouvrières et son « Zzz », posés avec leur ligne. */
  private rest!: ButtonHandle
  private zzz!: BitmapText
  private readonly scene: Phaser.Scene

  constructor(f: ComponentFactory, tips: Tooltips) {
    this.scene = f.scene
    const { x, y, w, h } = SCREEN.colony
    const anchor = { originX: OriginX.Left, originY: OriginY.Top } as const

    ninePanel(f, { ...anchor, x, y, width: w, height: h, skin: UI9.insetDark, tint: PANEL_TINT })
    f.bitmapText({
      font: FONT_KEY,
      size: FONTS.sizeSmall,
      text: STR.colony,
      tint: PALETTE.amber,
      x: x + w / 2,
      y: y + 18,
      originX: OriginX.Center,
      originY: OriginY.Top,
    })

    BEE_KINDS.forEach((kind, i) => {
      const top = y + 56 + i * ROW_H
      const textX = x + PANEL_PAD + ICON + 12
      const label = BEE_STR[kind.id]

      const icon = f.image({
        ...anchor,
        texture: TEX.iconBee,
        frame: '__BASE',
        tint: BEE_TINT[kind.id],
        x: x + PANEL_PAD,
        y: top + 12,
      })
      const name = f.bitmapText({
        ...anchor,
        font: FONT_KEY,
        size: FONTS.sizeSmall,
        text: label.name,
        tint: COLORS.cream,
        x: textX,
        y: top + 6,
      })
      const count = f.bitmapText({
        ...anchor,
        font: FONT_KEY,
        size: FONTS.sizeHint,
        text: '',
        tint: PALETTE.amber,
        x: textX,
        y: top + 34,
      })
      // La ligne des ouvrières cède sa droite à l'interrupteur : la zone
      // d'infobulle couvre tout le reste, et le bouton doit rester cliquable —
      // deux zones superposées, c'est la plus haute qui prend tout.
      const tipW = kind.id === 'worker' ? w - 16 - REST_W - PANEL_PAD : w - 16
      const hit = tips.hotspot(f, {
        x: x + 8,
        y: top,
        width: tipW,
        height: ROW_H - 4,
        title: label.name,
        text: label.tip,
        side: 'right',
      })

      // L'interrupteur de la transformation, SUR LA LIGNE DES OUVRIÈRES.
      //
      // Il double le clic sur la jauge de la ruche — une jauge cliquable ne dit
      // pas qu'elle l'est, le panneau des effectifs, si. Mais il ne peut pas
      // vivre au bas du panneau : là il commanderait « la colonie », alors
      // qu'on ne met au repos que les ouvrières. La butineuse, elle, vole
      // toujours. Sur sa ligne, la portée du bouton se lit sans phrase.
      if (kind.id === 'worker') {
        // Le sommeil se dit à côté de l'effectif, pas seulement sur le bouton :
        // le bouton nomme l'action à venir, le Zzz dit l'état présent — et c'est
        // l'état qu'on cherche quand on se demande pourquoi le miel ne monte
        // plus. Ce sont les points qui le suivent qui respirent, pas le mot :
        // il doit rester posé pour se lire.
        this.zzz = f.bitmapText({
          ...anchor,
          font: FONT_KEY,
          size: FONTS.sizeHint,
          text: STR.asleep,
          tint: PALETTE.oliveBrown,
          x: textX + ZZZ_X,
          y: top + 34,
        })

        this.rest = button(f, {
          x: x + w - PANEL_PAD - REST_W / 2,
          y: top + ROW_H / 2 - 4,
          width: REST_W,
          label: STR.workerRest,
          size: FONTS.sizeHint,
          font: FONT_KEY,
          color: COLORS.cream,
          onClick: () => gameState.setBrewing(!gameState.brewEnabled),
        })
      }

      this.rows.push({ id: kind.id, icon, name, count, hit })
    })
  }

  update(): void {
    const visible = gameState.visibleKinds
    for (const row of this.rows) {
      const shown = visible.includes(row.id)
      row.icon.visible = shown
      row.name.visible = shown
      row.count.visible = shown
      row.hit.visible = shown
      if (!shown) continue

      // Une caste encore verrouillée garde son nom (le joueur doit savoir ce
      // qui l'attend) mais s'affiche en sourdine.
      const owned = gameState.bees[row.id]
      row.icon.tint = owned > 0 ? BEE_TINT[row.id] : PALETTE.oliveBrown
      row.name.tint = owned > 0 ? COLORS.cream : PALETTE.oliveBrown
      row.count.tint = owned > 0 ? PALETTE.amber : PALETTE.oliveBrown
      setText(row.count, owned > 0 ? `x${fmtCount(owned)}` : STR.locked)
    }

    this.rest.visible = gameState.canBrew
    if (gameState.canBrew) {
      setText(this.rest.label, gameState.brewEnabled ? STR.workerRest : STR.workerBrew)
    }

    const asleep = gameState.canBrew && !gameState.brewEnabled
    this.zzz.visible = asleep
    if (asleep) {
      // Le « Zzz » ne bouge pas — c'est lui qui porte l'information, et une
      // information qui clignote se lit mal. Ce sont les points qui respirent.
      const dots = 1 + Math.floor(((this.scene.time.now % ZZZ_MS) / ZZZ_MS) * ZZZ_DOTS)
      setText(this.zzz, STR.asleep + '.'.repeat(dots))
    }
  }
}
