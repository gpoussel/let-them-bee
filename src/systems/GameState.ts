import { BEE_KINDS, ECONOMY, HIVE, type BeeKindId } from '../config/balance'
import { GAME } from '../config/game'
import {
  COMB,
  NEIGHBORS,
  UPGRADE_EFFECT,
  type CombCell,
  type UpgradeKind,
} from '../config/upgrades'
import { isBetter, type Route } from './Route'

const SAVE_KEY = GAME.saveKey

/** Effectif par caste. Une partie commence avec l'unique butineuse du joueur. */
export type BeePopulation = Record<BeeKindId, number>

function emptyPopulation(): BeePopulation {
  return { forager: 1, worker: 0, warrior: 0 }
}

export interface SaveData {
  nectar: number
  honey: number
  royalJelly: number
  bees: BeePopulation
  bestHoney: number
  queens: number
  /** Identifiants des alvéoles achetées (cf. config/upgrades). */
  comb: string[]
  /** Meilleur trajet de butinage connu (cf. systems/Route). */
  route: Route | null
}

// État global du jeu (monnaies, effectifs, prestige). Persisté en localStorage.
export class GameState {
  /** Réserve de nectar de la RUCHE (plafonnée par `nectarCapacity`). */
  nectar = 0
  honey = 0
  royalJelly = 0
  bees: BeePopulation = emptyPopulation()
  bestHoney = 0
  queens = 0
  /** Meilleur trajet enregistré, celui que la butineuse refait en boucle. */
  route: Route | null = null
  /** Alvéoles du rayon déjà payées. */
  comb = new Set<string>()

  // --- Le rayon (améliorations) -------------------------------------------

  /** Nombre d'alvéoles achetées dans une branche = son niveau. */
  levelOf(kind: UpgradeKind): number {
    let n = 0
    for (const cell of COMB) if (cell.kind === kind && this.comb.has(cell.id)) n++
    return n
  }

  /** Contenance de la réserve, améliorations comprises. */
  get nectarCapacity(): number {
    return HIVE.nectarCapacity + this.levelOf('storage') * UPGRADE_EFFECT.storageStep
  }

  /** Multiplicateur de vitesse de vol de la butineuse. */
  get flightMult(): number {
    return 1 + this.levelOf('flight') * UPGRADE_EFFECT.flightStep
  }

  /** Multiplicateur de vitesse du calendrier des fleurs. */
  get growthMult(): number {
    return 1 + this.levelOf('growth') * UPGRADE_EFFECT.growthStep
  }

  owns(cell: CombCell): boolean {
    return this.comb.has(cell.id)
  }

  /**
   * Une alvéole n'apparaît que si elle touche du construit : la ruche au départ,
   * puis n'importe quelle alvéole payée. Le rayon se découvre en s'étendant —
   * le joueur ne voit jamais la carte entière, seulement le bord de sa ruche.
   */
  isRevealed(cell: CombCell): boolean {
    for (const [dq, dr] of NEIGHBORS) {
      const q = cell.q + dq
      const r = cell.r + dr
      // La ruche compte comme construite : c'est elle qui amorce le rayon.
      if (q === 0 && r === 0) return true
      const neighbor = COMB.find((c) => c.q === q && c.r === r)
      if (neighbor && this.comb.has(neighbor.id)) return true
    }
    return false
  }

  /** Ce dont dispose le joueur dans la monnaie d'une alvéole. */
  balanceFor(cell: CombCell): number {
    return cell.currency === 'honey' ? this.honey : this.nectar
  }

  canBuy(cell: CombCell): boolean {
    return !this.owns(cell) && this.isRevealed(cell) && this.balanceFor(cell) >= cell.cost
  }

  /** Une alvéole visible et payable quelque part : le rayon a quelque chose à dire. */
  get combHasOffer(): boolean {
    return COMB.some((cell) => this.canBuy(cell))
  }

  /** Achète une alvéole dans SA monnaie. Renvoie faux si elle n'est pas à portée. */
  buyCell(cell: CombCell): boolean {
    if (!this.canBuy(cell)) return false
    if (cell.currency === 'honey') this.honey -= cell.cost
    else this.nectar -= cell.cost
    this.comb.add(cell.id)
    // La branche « butineuses » n'améliore rien : elle ajoute une abeille de
    // plus sur le trajet, donc c'est l'effectif qu'il faut bouger.
    if (cell.kind === 'foragers') this.bees.forager += 1
    return true
  }

  // --- Ressources ---------------------------------------------------------

  /** Verse du nectar dans la réserve. Renvoie ce qui a RÉELLEMENT été stocké. */
  addNectar(amount: number): number {
    const stored = Math.min(amount, this.nectarCapacity - this.nectar)
    if (stored <= 0) return 0
    this.nectar += stored
    return stored
  }

  spendNectar(amount: number): boolean {
    if (this.nectar < amount) return false
    this.nectar -= amount
    return true
  }

  /**
   * Propose un trajet. Il n'est retenu que s'il rapporte plus de nectar par
   * seconde que le précédent — un tour peut donc être plus long et gagner.
   * Renvoie vrai s'il a été adopté.
   */
  proposeRoute(route: Route): boolean {
    if (!isBetter(route, this.route)) return false
    this.route = route
    return true
  }

  /**
   * Castes montrées au joueur : celles qu'il possède, plus la SUIVANTE — celle
   * qu'il lui reste à débloquer. Les castes d'après n'existent pas encore à ses
   * yeux (au départ : butineuse + ouvrière, la guerrière reste cachée).
   */
  get visibleKinds(): BeeKindId[] {
    let last = 0
    BEE_KINDS.forEach((kind, i) => {
      if (this.bees[kind.id] > 0) last = i
    })
    return BEE_KINDS.slice(0, Math.min(last + 2, BEE_KINDS.length)).map((k) => k.id)
  }

  /** Miel produit passivement par la ruche, par seconde. */
  get honeyPerSecond(): number {
    return BEE_KINDS.reduce((sum, kind) => sum + this.bees[kind.id] * kind.production, 0)
  }

  addHoney(amount: number): void {
    this.honey += amount
    this.royalJelly += amount * ECONOMY.royalJellyRate
    if (this.honey > this.bestHoney) this.bestHoney = this.honey
  }

  /** Production passive de la ruche (appelée chaque frame). */
  tickBees(dt: number): void {
    const rate = this.honeyPerSecond
    if (rate > 0) this.addHoney(rate * dt)
  }

  spendHoney(amount: number): boolean {
    if (this.honey < amount) return false
    this.honey -= amount
    return true
  }

  save(): void {
    if (!GAME.saveEnabled) return
    const data: SaveData = {
      nectar: this.nectar,
      honey: this.honey,
      royalJelly: this.royalJelly,
      bees: { ...this.bees },
      bestHoney: this.bestHoney,
      queens: this.queens,
      comb: [...this.comb],
      route: this.route,
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
      this.nectar = data.nectar ?? 0
      this.honey = data.honey ?? 0
      this.royalJelly = data.royalJelly ?? 0
      this.bees = { ...emptyPopulation(), ...data.bees }
      // On ne relit que des identifiants d'alvéoles qui existent encore : une
      // sauvegarde d'avant un remaniement du rayon ne doit pas ressusciter une
      // case disparue.
      const saved = Array.isArray(data.comb) ? data.comb : []
      this.comb = new Set(saved.filter((id) => COMB.some((c) => c.id === id)))
      this.bestHoney = data.bestHoney ?? 0
      this.queens = data.queens ?? 0
      // Un trajet tronqué (sauvegarde d'une version antérieure, altération)
      // est écarté plutôt que rejoué de travers.
      const route = data.route
      this.route = route && Array.isArray(route.pts) && route.pts.length >= 4 ? route : null
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
