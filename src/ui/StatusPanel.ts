// Bandeau sous le pré : le poste de commande du TRAJET.
//
// C'est ici que se joue la boucle du jeu. Le pré rejoue en permanence le
// meilleur tour connu ; ce bandeau en affiche le bilan (durée, nectar, et
// surtout le nectar par seconde, seul critère de comparaison) et propose au
// joueur d'en voler un nouveau pour tenter de faire mieux.

import type { BitmapText, ComponentFactory } from 'phaser-pixui'
import { ROUTE } from '../config/balance'
import { WORLD } from '../config/game'
import { STR } from '../config/strings'
import { FONT_KEY } from '../gfx/font'
import { routeRate, type Route } from '../systems/Route'
import { button, ninePanel, OriginX, OriginY, setText, UI9 } from './pixui'
import { COLORS, FONTS, PALETTE, PANEL_PAD, PANEL_TINT, SCREEN } from './theme'
import { wrap } from './tooltip'

/** Colonnes du bandeau, en offset depuis son bord gauche. */
const COL_MESSAGE = PANEL_PAD
const COL_STATS = 334
const COL_ACTION = 544
/** Largeur d'une des trois cases du bilan (libellé au-dessus, valeur en dessous). */
const STAT_W = 66
/** Largeur du bouton et du compteur. */
const ACTION_W = 160

/** Bilan du meilleur tour : durée, nectar récolté, nectar par seconde. */
interface BestRun {
  values: BitmapText[]
}

export interface StatusPanelOpts {
  /** Clic sur le bouton : démarrer un enregistrement, ou abandonner celui en cours. */
  onToggleRecord: () => void
}

export class StatusPanel {
  private readonly message: BitmapText
  private readonly best: BestRun
  private readonly timer: BitmapText
  private readonly buttonLabel: BitmapText

  constructor(left: ComponentFactory, right: ComponentFactory, o: StatusPanelOpts) {
    const { x, y, w, h } = SCREEN.status
    const anchor = { originX: OriginX.Left, originY: OriginY.Top } as const

    ninePanel(left, {
      ...anchor,
      x,
      y,
      width: w,
      height: h,
      skin: UI9.insetDark,
      tint: PANEL_TINT,
    })

    // Colonne 1 — le pré et ce qu'il s'y passe en ce moment.
    left.bitmapText({
      ...anchor,
      font: FONT_KEY,
      size: FONTS.sizeSmall,
      text: STR.meadow,
      tint: PALETTE.amber,
      x: x + COL_MESSAGE,
      y: y + 8,
    })
    this.message = left.bitmapText({
      ...anchor,
      font: FONT_KEY,
      size: FONTS.sizeHint,
      text: '',
      tint: COLORS.cream,
      x: x + COL_MESSAGE,
      y: y + 40,
    })

    // Colonne 2 — le bilan du tour de référence. Le bandeau étant devenu bas,
    // les trois chiffres sont posés CÔTE À CÔTE plutôt qu'empilés : ils se
    // lisent d'un balayage horizontal, et la hauteur gagnée revient au pré.
    left.bitmapText({
      ...anchor,
      font: FONT_KEY,
      size: FONTS.sizeHint,
      text: STR.bestRun,
      tint: PALETTE.amber,
      x: x + COL_STATS,
      y: y + 10,
    })
    this.best = { values: [] }
    const cols = [STR.lapTime, STR.nectar, STR.lapRate]
    cols.forEach((text, i) => {
      const colX = x + COL_STATS + i * STAT_W
      left.bitmapText({
        ...anchor,
        font: FONT_KEY,
        size: FONTS.sizeHint,
        text,
        tint: PALETTE.oliveBrown,
        x: colX,
        y: y + 36,
      })
      this.best.values.push(
        left.bitmapText({
          ...anchor,
          font: FONT_KEY,
          size: FONTS.sizeHint,
          text: '',
          tint: COLORS.cream,
          x: colX,
          y: y + 56,
        }),
      )
    })

    // Colonne 3 — le compte à rebours de l'enregistrement, puis le bouton.
    //
    // Le compteur n'apparaît QUE pendant un tour : hors enregistrement il n'y a
    // rien à décompter, et un cadran mort à l'écran ne dit rien à personne.
    const gaugeX = x + COL_ACTION
    this.timer = right.bitmapText({
      font: FONT_KEY,
      size: FONTS.sizeTimer,
      text: '',
      tint: COLORS.cream,
      x: WORLD.width - (gaugeX + ACTION_W),
      y: y + 6,
      originX: OriginX.Right,
      originY: OriginY.Top,
    })

    this.buttonLabel = button(left, {
      x: gaugeX + ACTION_W / 2,
      y: y + h - 26,
      width: ACTION_W,
      label: STR.record,
      size: FONTS.sizeHint,
      font: FONT_KEY,
      color: COLORS.cream,
      onClick: o.onToggleRecord,
    })
  }

  /** Message d'état affiché sous le titre du pré (consigne ou verdict d'un tour). */
  setMessage(text: string): void {
    setText(this.message, wrap(text, 46))
  }

  /** Libellé du bouton : il change selon qu'un enregistrement est en cours. */
  setButtonLabel(text: string): void {
    setText(this.buttonLabel, text)
  }

  /**
   * Compteur du tour en cours, en ms — `null` quand rien n'est enregistré.
   * Il vire au rouge dans les dernières secondes : le couperet de 10 s tombe
   * quoi qu'il arrive, mieux vaut être rentré à la ruche avant.
   */
  setElapsed(ms: number | null): void {
    if (ms === null) {
      setText(this.timer, '')
      return
    }
    setText(this.timer, `${(ms / 1000).toFixed(1)}s`)
    this.timer.tint = ms >= ROUTE.warnMs ? COLORS.alert : COLORS.cream
  }

  update(route: Route | null): void {
    const [lap, nectar, rate] = this.best.values
    if (route) {
      setText(lap, `${(route.duration / 1000).toFixed(1)}s`)
      setText(nectar, `${Math.round(route.nectar)}`)
      setText(rate, routeRate(route).toFixed(2))
    } else {
      setText(lap, '-')
      setText(nectar, '-')
      setText(rate, '-')
    }
  }
}
