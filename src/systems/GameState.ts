import { ECONOMY } from '../config/balance'
import { GAME } from '../config/game'

const SAVE_KEY = GAME.saveKey

export interface SaveData {
  honey: number
  royalJelly: number
  workers: number
  bestHoney: number
  queens: number
}

// État global du jeu (monnaies, ouvrières, prestige). Persisté en localStorage.
export class GameState {
  honey = 0
  royalJelly = 0
  workers = 0
  bestHoney = 0
  queens = 0

  /** Dépose du nectar converti en miel (déjà multiplié par le combo côté scène). */
  addHoney(amount: number): void {
    this.honey += amount
    this.royalJelly += amount * ECONOMY.royalJellyRate
    if (this.honey > this.bestHoney) this.bestHoney = this.honey
  }

  /** Production passive des ouvrières (appelée chaque frame). */
  tickWorkers(dt: number): void {
    if (this.workers <= 0) return
    this.addHoney(this.workers * ECONOMY.workerProduction * dt)
  }

  spendHoney(amount: number): boolean {
    if (this.honey < amount) return false
    this.honey -= amount
    return true
  }

  save(): void {
    if (!GAME.saveEnabled) return
    const data: SaveData = {
      honey: this.honey,
      royalJelly: this.royalJelly,
      workers: this.workers,
      bestHoney: this.bestHoney,
      queens: this.queens,
    }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data))
    } catch {
      /* stockage indisponible (mode privé) : on ignore */
    }
  }

  load(): boolean {
    if (!GAME.saveEnabled) return false
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return false
      const data = JSON.parse(raw) as Partial<SaveData>
      this.honey = data.honey ?? 0
      this.royalJelly = data.royalJelly ?? 0
      this.workers = data.workers ?? 0
      this.bestHoney = data.bestHoney ?? 0
      this.queens = data.queens ?? 0
      return true
    } catch {
      return false
    }
  }

  static clear(): void {
    try {
      localStorage.removeItem(SAVE_KEY)
    } catch {
      /* ignore */
    }
  }
}

// Instance partagée entre les scènes.
export const gameState = new GameState()
