import Phaser from 'phaser'
import { settings } from './Settings'

// Gestionnaire audio global : un SFX d'interface partagé par tous les boutons
// et une boucle musicale par écran. Les volumes viennent des préférences
// joueur ({@link settings}) et s'appliquent en direct.

/** Clés des sons chargés au boot. */
export const SND = {
  click: 'snd-ui-click',
  forage: 'snd-forage',
  honey: 'snd-honey',
  titleTheme: 'snd-title-theme',
  gameTheme: 'snd-game-theme',
} as const

/** Durée par défaut d'un fondu musical (ms) — calée sur la transition d'écran. */
export const MUSIC_FADE_MS = 700

/** Une piste en cours de fondu (entrant ou sortant). */
interface Fade {
  sound: Phaser.Sound.BaseSound & { volume: number }
  from: number
  to: number
  elapsed: number
  duration: number
  /** Détruire le son en fin de fondu (fondu sortant). */
  stopAtEnd: boolean
}

class AudioManager {
  private manager?: Phaser.Sound.BaseSoundManager
  private music?: Phaser.Sound.BaseSound
  private musicKey?: string
  /** Fondus en cours ; l'entrant est aussi dans {@link music}. */
  private fades: Fade[] = []

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
    settings.onChange = () => {
      this.applyVolumes()
    }
    this.applyVolumes()
    // Les fondus sont pilotés par la boucle du jeu et non par une scène : un
    // fondu sortant doit survivre à la destruction de la scène qui l'a lancé.
    scene.game.events.on(Phaser.Core.Events.PRE_STEP, this.step, this)
  }

  /** SFX de clic, joué par tous les boutons de l'interface. */
  playClick(): void {
    this.manager?.play(SND.click, { volume: settings.sfxVolume })
  }

  /**
   * SFX de jeu, joué par-dessus la musique.
   *
   * @param gain atténuation relative au volume SFX du joueur (1 = plein pot).
   *   C'est ce qui distingue un geste du joueur d'un geste rejoué par le jeu :
   *   le trajet en boucle tourne en fond, il ne doit pas couvrir la partie.
   */
  playSfx(key: string, gain = 1): void {
    this.manager?.play(key, { volume: settings.sfxVolume * gain })
  }

  /**
   * Lance (ou conserve) une boucle musicale. Rejouer la même clé est un no-op :
   * la musique traverse les rechargements de scène sans repartir de zéro.
   *
   * @param fadeMs durée du fondu croisé avec la piste en cours (0 = coupe nette).
   */
  playMusic(key: string, fadeMs = 0): void {
    if (!this.manager || this.musicKey === key) return
    if (fadeMs > 0) this.fadeOutCurrent(fadeMs)
    else this.stopMusic()

    this.musicKey = key
    const music = this.manager.add(key, {
      loop: true,
      volume: fadeMs > 0 ? 0 : settings.musicVolume,
    }) as Phaser.Sound.BaseSound & { volume: number }
    this.music = music
    if (fadeMs > 0) {
      this.fades.push({
        sound: music,
        from: 0,
        to: settings.musicVolume,
        elapsed: 0,
        duration: fadeMs,
        stopAtEnd: false,
      })
    }
    // Les navigateurs bloquent l'audio tant que l'utilisateur n'a pas
    // interagi : Phaser émet `unlocked` une fois le contexte débloqué.
    if (this.manager.locked) {
      this.manager.once(Phaser.Sound.Events.UNLOCKED, () => music.play())
    } else {
      music.play()
    }
  }

  stopMusic(): void {
    this.fades = this.fades.filter((f) => f.sound !== this.music)
    this.music?.destroy()
    this.music = undefined
    this.musicKey = undefined
  }

  /** Détache la piste courante et la fait disparaître en douceur. */
  private fadeOutCurrent(fadeMs: number): void {
    const current = this.music as (Phaser.Sound.BaseSound & { volume: number }) | undefined
    this.music = undefined
    this.musicKey = undefined
    if (!current) return
    // Un fondu déjà en cours sur cette piste est remplacé par le sortant.
    this.fades = this.fades.filter((f) => f.sound !== current)
    this.fades.push({
      sound: current,
      from: current.volume,
      to: 0,
      elapsed: 0,
      duration: fadeMs,
      stopAtEnd: true,
    })
  }

  /** Avance les fondus en cours (appelé à chaque frame du jeu). */
  private step(_time: number, delta: number): void {
    if (!this.fades.length) return
    this.fades = this.fades.filter((f) => {
      f.elapsed += delta
      const t = Math.min(1, f.elapsed / f.duration)
      f.sound.volume = f.from + (f.to - f.from) * t
      if (t < 1) return true
      if (f.stopAtEnd) f.sound.destroy()
      return false
    })
  }

  /** Réapplique les volumes courants aux sons en cours (curseurs de réglages). */
  private applyVolumes(): void {
    const music: (Phaser.Sound.BaseSound & { volume?: number }) | undefined = this.music
    if (!music) return
    // Pendant un fondu entrant, c'est la cible qui bouge : sinon le curseur
    // serait écrasé à la frame suivante.
    const fade = this.fades.find((f) => f.sound === music)
    if (fade) fade.to = settings.musicVolume
    else music.volume = settings.musicVolume
  }
}

export const audio = new AudioManager()
