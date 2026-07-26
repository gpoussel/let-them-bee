// Bandeau sous le pré : le poste de commande du TRAJET.
//
// C'est ici que se joue la boucle du jeu. Le pré rejoue en permanence le
// meilleur tour connu ; ce bandeau en affiche le bilan (durée, nectar, et
// surtout le nectar par seconde, seul critère de comparaison) et propose au
// joueur d'en voler un nouveau pour tenter de faire mieux.

import type Phaser from 'phaser'
import type { BitmapText, ComponentFactory } from 'phaser-pixui'
import { WORLD } from '../config/game'
import { STR } from '../config/strings'
import { FONT_KEY } from '../gfx/font'
import { gameState } from '../systems/GameState'
import { routeRate, type Route } from '../systems/Route'
import { fmtBig } from './format'
import { Nudge } from './Nudge'
import { button, ninePanel, OriginX, OriginY, setText, UI9 } from './pixui'
import { COLORS, FONTS, HUD, PALETTE, PANEL_PAD, PANEL_TINT, SCREEN } from './theme'
import { wrap } from './tooltip'

/** Colonnes du bandeau, en offset depuis son bord gauche. */
const COL_MESSAGE = PANEL_PAD
const COL_STATS = 334
const COL_ACTION = 544
/** Largeur d'une des trois cases du bilan (libellé au-dessus, valeur en dessous). */
const STAT_W = 66
/** Largeur du bouton et du compteur. */
const ACTION_W = 160

/**
 * Bilan du meilleur tour : durée, nectar récolté, nectar par seconde.
 *
 * `parts` contient TOUT ce que le bilan écrit, libellés compris : tant qu'aucun
 * tour n'existe, ce bloc n'a rien à dire et s'efface entièrement au profit de
 * l'appel à l'action. Trois tirets sous trois libellés, c'est un tableau vide
 * là où le joueur a besoin qu'on lui dise quoi faire.
 */
interface BestRun {
  values: BitmapText[]
  parts: BitmapText[]
}

export interface StatusPanelOpts {
  /** Clic sur le bouton : démarrer un enregistrement, ou abandonner celui en cours. */
  onToggleRecord: () => void
}

export class StatusPanel {
  private readonly scene: Phaser.Scene
  private readonly message: BitmapText
  private readonly best: BestRun
  /** Appel à l'action montré à la place du bilan, tant qu'il n'y a pas de tour. */
  private readonly callToAction: BitmapText[]
  private readonly nudge: Nudge
  private readonly timer: BitmapText
  private readonly buttonLabel: BitmapText
  /** Consigne permanente, celle qui revient quand un verdict s'efface. */
  private baseMessage = ''
  private verdictTimer: Phaser.Time.TimerEvent | null = null

  constructor(
    scene: Phaser.Scene,
    left: ComponentFactory,
    right: ComponentFactory,
    o: StatusPanelOpts,
  ) {
    this.scene = scene
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
    const title = left.bitmapText({
      ...anchor,
      font: FONT_KEY,
      size: FONTS.sizeHint,
      text: STR.bestRun,
      tint: PALETTE.amber,
      x: x + COL_STATS,
      y: y + 10,
    })
    this.best = { values: [], parts: [title] }
    const cols = [STR.lapTime, STR.nectar, STR.lapRate]
    cols.forEach((text, i) => {
      const colX = x + COL_STATS + i * STAT_W
      this.best.parts.push(
        left.bitmapText({
          ...anchor,
          font: FONT_KEY,
          size: FONTS.sizeHint,
          text,
          tint: PALETTE.oliveBrown,
          x: colX,
          y: y + 36,
        }),
      )
      const value = left.bitmapText({
        ...anchor,
        font: FONT_KEY,
        size: FONTS.sizeHint,
        text: '',
        tint: COLORS.cream,
        x: colX,
        y: y + 56,
      })
      this.best.values.push(value)
      this.best.parts.push(value)
    })

    // Ce que le bilan laisse voir tant qu'il est vide : le geste à faire, et une
    // flèche sur le bouton qui le déclenche. Le joueur n'a aucun moyen de deviner
    // qu'on lui demande de PILOTER une abeille dans un jeu qui, sinon, se joue
    // tout seul — c'est le seul endroit où le jeu se permet de le lui dicter.
    this.callToAction = [
      left.bitmapText({
        ...anchor,
        font: FONT_KEY,
        size: FONTS.sizeHint,
        text: STR.firstRunTitle,
        tint: PALETTE.amber,
        x: x + COL_STATS,
        y: y + 10,
      }),
      left.bitmapText({
        ...anchor,
        font: FONT_KEY,
        size: FONTS.sizeHint,
        text: wrap(STR.firstRunHint, 32),
        tint: COLORS.cream,
        x: x + COL_STATS,
        y: y + 32,
      }),
    ]

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
    }).label

    // La flèche se tient au-dessus du bouton, pas dessus : elle le désigne, et
    // laisse le curseur l'atteindre.
    this.nudge = new Nudge(scene, gaugeX + ACTION_W / 2, y + h - 58, 'down')
  }

  /**
   * Consigne PERMANENTE du bandeau : elle décrit l'état courant du pré et reste
   * affichée tant que cet état dure.
   */
  setMessage(text: string): void {
    this.baseMessage = text
    this.verdictTimer?.remove()
    this.verdictTimer = null
    setText(this.message, wrap(text, 46))
  }

  /**
   * Verdict d'un tour qui vient de se clore. Il passe devant la consigne, puis
   * s'efface de lui-même : passé quelques secondes, « New best run! » ne parle
   * plus du tour que le joueur a en tête, et rien ne le distingue d'une consigne.
   */
  flashMessage(text: string): void {
    this.verdictTimer?.remove()
    setText(this.message, wrap(text, 46))
    this.verdictTimer = this.scene.time.delayedCall(HUD.verdictMs, () => {
      this.verdictTimer = null
      setText(this.message, wrap(this.baseMessage, 46))
    })
  }

  /** Libellé du bouton : il change selon qu'un enregistrement est en cours. */
  setButtonLabel(text: string): void {
    setText(this.buttonLabel, text)
  }

  /**
   * Compteur du tour en cours, en ms — `null` quand rien n'est enregistré.
   * Il vire au rouge dans les dernières secondes : le couperet tombe quoi qu'il
   * arrive, mieux vaut être rentré à la ruche avant. Le seuil suit la lignée
   * (cf. `GameState.warnLapMs`) : une seconde de plus au tour, c'est une seconde
   * de plus avant l'alarme.
   */
  setElapsed(ms: number | null): void {
    if (ms === null) {
      setText(this.timer, '')
      return
    }
    setText(this.timer, `${(ms / 1000).toFixed(1)}s`)
    this.timer.tint = ms >= gameState.warnLapMs ? COLORS.alert : COLORS.cream
  }

  /** @param recording un tour est en cours d'enregistrement */
  update(route: Route | null, recording: boolean): void {
    // Le bilan et l'appel à l'action occupent la MÊME case : l'un ou l'autre,
    // jamais les deux. La flèche s'éteint avec l'appel à l'action — le geste est
    // acquis dès le premier tour, et une flèche qui reste devient du décor.
    //
    // Pendant l'enregistrement, l'appel à l'action se tait même s'il n'y a
    // toujours pas de tour : le joueur est EN TRAIN de faire ce qu'on lui
    // demande, le bouton dit désormais « Give up » — une flèche dessus
    // l'enverrait abandonner — et le compte à rebours occupe la place.
    const guiding = route === null && !recording
    for (const part of this.best.parts) part.visible = route !== null
    for (const part of this.callToAction) part.visible = guiding
    this.nudge.setVisible(guiding)

    if (!route) return

    const [lap, nectar, rate] = this.best.values
    setText(lap, `${(route.duration / 1000).toFixed(1)}s`)
    setText(nectar, fmtBig(Math.round(route.nectar)))
    setText(rate, routeRate(route).toFixed(2))
  }
}
