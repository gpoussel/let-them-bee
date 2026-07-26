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
import { ninePanel, OriginX, OriginY, setText, UI9 } from './pixui'
import { BEE_TINT, COLORS, FONTS, PALETTE, PANEL_PAD, PANEL_TINT, SCREEN } from './theme'
import type { Tooltips } from './tooltip'

/** Côté d'une icône de caste. */
const ICON = 32
/** Hauteur d'une ligne d'effectif. */
const ROW_H = 60

interface Row {
  id: BeeKindId
  icon: Image
  name: BitmapText
  count: BitmapText
  hit: Clickable
}

export class ColonyPanel {
  private readonly rows: Row[] = []

  constructor(f: ComponentFactory, tips: Tooltips) {
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
      const hit = tips.hotspot(f, {
        x: x + 8,
        y: top,
        width: w - 16,
        height: ROW_H - 4,
        title: label.name,
        text: label.tip,
        side: 'right',
      })

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
  }
}
