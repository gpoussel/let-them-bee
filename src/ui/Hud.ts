import type Phaser from 'phaser'
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
    this.status = new StatusPanel(scene, left, right, { onToggleRecord: o.onToggleRecord })

    this.tips.build()
    this.ui.commit()
  }

  /** Consigne permanente du bandeau du pré (elle décrit l'état courant). */
  setMessage(text: string): void {
    this.status.setMessage(text)
  }

  /** Verdict d'un tour : il passe devant la consigne, puis s'efface tout seul. */
  flashMessage(text: string): void {
    this.status.flashMessage(text)
  }

  /** Libellé du bouton d'enregistrement (il change d'état en cours de tour). */
  setRecordLabel(text: string): void {
    this.status.setButtonLabel(text)
  }

  /** Compteur du tour en cours, en ms (`null` : aucun enregistrement). */
  setElapsed(ms: number | null): void {
    this.status.setElapsed(ms)
  }

  /** @param recording un tour est en cours d'enregistrement (cf. StatusPanel). */
  update(recording = false): void {
    this.bar.update()
    this.colony.update()
    this.comb.update()
    this.status.update(gameState.route, recording)
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
      onComplete: () => {
        t.destroy()
      },
    })
  }

  /**
   * Même chose, avec l'icône de la ressource gagnée collée au nombre. Le miel et
   * la gelée royale tombent tous deux au-dessus de la ruche, à quelques secondes
   * d'écart : sans son pot, « +0.5 » ne dirait pas de quoi il parle.
   */
  popGain(x: number, y: number, texture: string, text: string, tint: number, color: string): void {
    const label = pixelText(this.scene, 0, 0, text, FONTS.sizePop, color).setOrigin(0, 0.5)
    const icon = this.scene.add.image(0, 0, texture).setTint(tint).setOrigin(0, 0.5)
    // Icône puis nombre, l'ensemble centré sur x : le groupe reste au-dessus de
    // la ruche quelle que soit la longueur du nombre.
    const gap = 4
    const total = icon.displayWidth + gap + label.width
    icon.x = -total / 2
    label.x = icon.x + icon.displayWidth + gap

    const group = this.scene.add.container(x, y, [icon, label]).setDepth(POP_DEPTH)
    this.scene.tweens.add({
      targets: group,
      y: y - HUD.popRise,
      alpha: 0,
      duration: HUD.popDuration,
      ease: 'Cubic.Out',
      onComplete: () => {
        group.destroy()
      },
    })
  }
}
