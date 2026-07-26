import Phaser from 'phaser'
import { STR } from '../config/strings'
import { Ui } from '../ui/pixui'
import { buildPrefsPanel } from '../ui/prefsPanel'
import { gameState } from '../systems/GameState'
import { audio, SND } from '../systems/Audio'
import { transitionOut, TRANSITION_MS } from '../gfx/transition'

// Menu de pause : la pop-up de réglages de l'écran-titre, plus un bouton de
// retour au titre. C'est une scène à part (et non un panel de GameScene) pour
// deux raisons : elle se dessine au-dessus du HUD sans jouer avec les
// profondeurs, et ses tweens restent vivants pendant que le jeu, lui, est figé.
export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause')
  }

  create(): void {
    const ui = new Ui(this)
    buildPrefsPanel(this, ui, {
      extraButtons: [
        {
          label: STR.backToTitle,
          onClick: () => {
            this.quitToTitle()
          },
        },
      ],
      onClose: () => {
        this.resumeGame()
      },
    })
    ui.commit()

    this.input.keyboard?.on('keydown-ESC', () => {
      this.resumeGame()
    })
  }

  /** Ferme le menu et rend la main au potager. */
  private resumeGame(): void {
    this.scene.resume('Game')
    this.scene.stop()
  }

  /**
   * Retour à l'écran-titre : sauvegarde, fondu musical, puis fermeture en nid
   * d'abeille jouée par cette scène (le jeu reste figé dessous).
   */
  private quitToTitle(): void {
    gameState.save()
    audio.playMusic(SND.titleTheme, TRANSITION_MS)
    transitionOut(this, () => {
      this.scene.stop('Game')
      this.scene.start('Title', { fromGame: true })
    })
  }
}
