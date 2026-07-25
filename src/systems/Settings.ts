// Préférences joueur (volumes). Persistées en localStorage indépendamment de
// la sauvegarde de partie : `GAME.saveEnabled` ne les concerne pas — un
// réglage de confort doit survivre même quand la progression est désactivée.

const PREFS_KEY = 'let-them-bee/prefs/v1'

export interface PrefsData {
  musicVolume: number
  sfxVolume: number
}

/** Volume par défaut : à mi-course, le jeu ne doit pas surprendre au lancement. */
export const DEFAULT_VOLUME = 0.5

// Les volumes sont arrondis au centième : un curseur donne une valeur
// continue, inutile de persister 15 décimales.
const clamp01 = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 100) / 100

export class Settings {
  musicVolume = DEFAULT_VOLUME
  sfxVolume = DEFAULT_VOLUME

  /** Appelé à chaque changement de volume (branché par le gestionnaire audio). */
  onChange?: (settings: Settings) => void

  setMusicVolume(value: number): void {
    this.musicVolume = clamp01(value)
    this.changed()
  }

  setSfxVolume(value: number): void {
    this.sfxVolume = clamp01(value)
    this.changed()
  }

  private changed(): void {
    this.onChange?.(this)
    this.save()
  }

  save(): void {
    const data: PrefsData = { musicVolume: this.musicVolume, sfxVolume: this.sfxVolume }
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(data))
    } catch {
      /* stockage indisponible (mode privé) : on ignore */
    }
  }

  load(): void {
    try {
      const raw = localStorage.getItem(PREFS_KEY)
      if (!raw) return
      const data = JSON.parse(raw) as Partial<PrefsData>
      this.musicVolume = clamp01(data.musicVolume ?? DEFAULT_VOLUME)
      this.sfxVolume = clamp01(data.sfxVolume ?? DEFAULT_VOLUME)
    } catch {
      /* préférences illisibles : on garde les valeurs par défaut */
    }
  }
}

// Instance partagée entre les scènes.
export const settings = new Settings()
