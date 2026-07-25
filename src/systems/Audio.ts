import Phaser from 'phaser'
import { settings } from './Settings'

// Gestionnaire audio global : un SFX d'interface partagé par tous les boutons
// et une boucle musicale par écran. Les volumes viennent des préférences
// joueur ({@link settings}) et s'appliquent en direct.

/** Clés des sons chargés au boot. */
export const SND = {
  click: 'snd-ui-click',
  titleTheme: 'snd-title-theme',
} as const

class AudioManager {
  private manager?: Phaser.Sound.BaseSoundManager
  private music?: Phaser.Sound.BaseSound
  private musicKey?: string

  /**
   * Branche le gestionnaire de sons du jeu. À appeler une fois au boot, après
   * le chargement des sons.
   */
  install(scene: Phaser.Scene): void {
    this.manager = scene.sound
    // Par défaut Phaser coupe le son dès que l'onglet perd le focus : on garde
    // la musique en fond, c'est un jeu qu'on laisse tourner à côté.
    this.manager.pauseOnBlur = false
    settings.load()
    settings.onChange = () => this.applyVolumes()
    this.applyVolumes()
  }

  /** SFX de clic, joué par tous les boutons de l'interface. */
  playClick(): void {
    this.manager?.play(SND.click, { volume: settings.sfxVolume })
  }

  /**
   * Lance (ou conserve) une boucle musicale. Rejouer la même clé est un no-op :
   * la musique traverse les rechargements de scène sans repartir de zéro.
   */
  playMusic(key: string): void {
    if (!this.manager || this.musicKey === key) return
    this.stopMusic()
    this.musicKey = key
    const music = this.manager.add(key, { loop: true, volume: settings.musicVolume })
    this.music = music
    // Les navigateurs bloquent l'audio tant que l'utilisateur n'a pas
    // interagi : Phaser émet `unlocked` une fois le contexte débloqué.
    if (this.manager.locked) {
      this.manager.once(Phaser.Sound.Events.UNLOCKED, () => music.play())
    } else {
      music.play()
    }
  }

  stopMusic(): void {
    this.music?.destroy()
    this.music = undefined
    this.musicKey = undefined
  }

  /** Réapplique les volumes courants aux sons en cours (curseurs de réglages). */
  private applyVolumes(): void {
    const music = this.music as Phaser.Sound.BaseSound & { volume?: number }
    if (music) music.volume = settings.musicVolume
  }
}

export const audio = new AudioManager()
