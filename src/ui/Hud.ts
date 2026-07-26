import Phaser from 'phaser'
import { HEX, FONTS, HUD } from './theme'
import { pixelText } from './text'
import { Ui } from './pixui'
import { ResourceBar } from './ResourceBar'
import { ColonyPanel } from './ColonyPanel'
import { CombButton } from './CombButton'
import { StatusPanel } from './StatusPanel'
import { Tooltips } from './tooltip'
import { gameState } from '../systems/GameState'

/** Profondeur des textes flottants : au-dessus de tout, jeu comme interface. */
const POP_DEPTH = 300

export interface HudOpts {
  /** Clic sur le bouton du bandeau : lancer ou abandonner un enregistrement. */
  onToggleRecord: () => void
  /** Clic sur la ruche : ouvrir le rayon. C'est une SCÈNE, pas un panel d'ici. */
  onOpenComb: () => void
}

// Interface de la GameScene. Elle occupe l'essentiel de l'écran — le pré où
// vole l'abeille n'en est qu'une part — et se compose de quatre cadres :
//
//   ┌────────────── barre de ressources ─────────────┐
//   │ effectifs │               pré                  │
//   │ bilan     │           état du vol              │
//
// Tout est posé en coordonnées absolues du monde (960x540, scale FIT) : deux
// fabriques pixui suffisent, l'une ancrée à gauche, l'autre à droite pour les
// valeurs alignées sur le bord droit d'un cadre. Les infobulles sont bâties en
// dernier pour passer au-dessus des cadres.
export class Hud {
  private readonly scene: Phaser.Scene
  private readonly ui: Ui
  private readonly tips: Tooltips
  private readonly bar: ResourceBar
  private readonly colony: ColonyPanel
  private readonly comb: CombButton
  private readonly status: StatusPanel

  constructor(scene: Phaser.Scene, o: HudOpts) {
    this.scene = scene
    this.ui = new Ui(scene)
    this.tips = new Tooltips(this.ui)

    const left = this.ui.topLeft
    const right = this.ui.topRight

    this.bar = new ResourceBar(left, this.tips)
    this.colony = new ColonyPanel(left, this.tips)
    this.comb = new CombButton(scene, left, { onOpen: o.onOpenComb })
    this.status = new StatusPanel(left, right, { onToggleRecord: o.onToggleRecord })

    this.tips.build()
    this.ui.commit()
  }

  /** Consigne / verdict affiché dans le bandeau du pré. */
  setMessage(text: string): void {
    this.status.setMessage(text)
  }

  /** Libellé du bouton d'enregistrement (il change d'état en cours de tour). */
  setRecordLabel(text: string): void {
    this.status.setButtonLabel(text)
  }

  /** Compteur du tour en cours, en ms (`null` : aucun enregistrement). */
  setElapsed(ms: number | null): void {
    this.status.setElapsed(ms)
  }

  update(): void {
    this.bar.update()
    this.colony.update()
    this.comb.update()
    this.status.update(gameState.route)
    this.tips.update()
  }

  /** Texte flottant qui pop et remonte (ex "+5", "Perfect!"). Transient : reste
   * en BitmapText de scène tweené (hors layout pixui). */
  popText(x: number, y: number, text: string, color: string = HEX.cream): void {
    const t = pixelText(this.scene, x, y, text, FONTS.sizePop, color)
      .setOrigin(0.5, 0.5)
      .setDepth(POP_DEPTH)
    this.scene.tweens.add({
      targets: t,
      y: y - HUD.popRise,
      alpha: 0,
      duration: HUD.popDuration,
      ease: 'Cubic.Out',
      onComplete: () => t.destroy(),
    })
  }
}
