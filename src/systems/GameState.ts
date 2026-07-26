import { BEE_KINDS, HIVE, HONEY, type BeeKindId } from '../config/balance'
import { GAME } from '../config/game'
import {
  COMB,
  NEIGHBORS,
  previousTier,
  UPGRADE_EFFECT,
  type CombCell,
  type UpgradeKind,
} from '../config/upgrades'
import { isBetter, isValidRoute, type Route } from './Route'

const SAVE_KEY = GAME.saveKey

/** Effectif par caste. Une partie commence avec l'unique butineuse du joueur. */
export type BeePopulation = Record<BeeKindId, number>

function emptyPopulation(): BeePopulation {
  return { forager: 1, worker: 0, warrior: 0 }
}

/**
 * Contenu d'une sauvegarde.
 *
 * **Tout état de jeu doit figurer ici.** Une mécanique qui ajoute un compteur,
 * une caste, une monnaie ou un interrupteur ajoute son champ dans le même
 * changement : un état oublié ne se remarque pas au développement (la partie
 * courante le tient en mémoire), seulement chez le joueur qui revient.
 */
export interface SaveData {
  /**
   * Version du jeu qui a écrit la sauvegarde. Relue par une AUTRE version, la
   * sauvegarde est détruite et non migrée (cf. `load`).
   */
  version: string
  nectar: number
  honey: number
  royalJelly: number
  bees: BeePopulation
  bestHoney: number
  queens: number
  /** Identifiants des alvéoles achetées (cf. config/upgrades). */
  comb: string[]
  /** Lot de transformation en cours : nectar déjà engagé, avancement (0..1). */
  brewing: boolean
  brewProgress: number
  /** Miel gagné depuis la dernière dose de gelée royale. */
  honeySinceJelly: number
  /** La transformation est-elle en marche (cf. `setBrewing`). */
  brewEnabled: boolean
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
  /** Un lot de nectar est engagé dans la transformation. */
  brewing = false
  /** Avancement du lot en cours, de 0 à 1 (c'est la jauge au-dessus de la ruche). */
  brewProgress = 0
  /** Miel gagné depuis la dernière dose de gelée royale. */
  honeySinceJelly = 0
  /**
   * Interrupteur de la transformation. Elle tourne toute seule dès qu'il y a de
   * quoi, c'est le comportement par défaut — mais elle mord sur la réserve, et
   * une réserve qui ne monte plus ne paie plus les alvéoles des rangs les plus hauts. Le
   * joueur doit donc pouvoir la couper le temps d'économiser, sinon le premier
   * lot le priverait pour toujours de ce qu'il n'a pas encore acheté.
   */
  brewEnabled = true

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
   * Une alvéole se dévoile quand ce qui la précède est bâti :
   *
   *   - son prérequis explicite, s'il y en a un (cf. `CombCell.needs`) ;
   *   - le rang précédent de SA branche, à partir du rang 2 ;
   *   - à défaut, le contact avec une alvéole bâtie DE SA BRANCHE. Les branches
   *     s'incurvent : le rang V se recolle contre le rang III, et une alvéole
   *     qu'on touche du doigt mais qui n'existe pas encore se lit comme un trou
   *     dans le rayon. Le voisinage de branche la montre dès que la cire arrive
   *     à côté d'elle — quitte à ce qu'elle s'achète avant le rang qui la
   *     précède : ce n'est pas un raccourci, les deux se paient de toute façon ;
   *   - pour un rang 1, le contact avec n'importe quel construit (la ruche au
   *     départ, puis toute alvéole payée) : c'est lui qui amorce une branche.
   *
   * Le voisinage TOUTES branches confondues reste réservé au rang 1 : le rayon
   * est serré au centre, et sinon acheter la ventilation dévoilerait le
   * troisième palier de réserve.
   *
   * Le joueur ne voit donc jamais la carte entière, seulement le bord de sa ruche.
   */
  isRevealed(cell: CombCell): boolean {
    if (cell.needs !== undefined && !this.comb.has(cell.needs)) return false
    const prev = previousTier(cell)
    if (prev && this.comb.has(prev.id)) return true
    for (const [dq, dr] of NEIGHBORS) {
      const q = cell.q + dq
      const r = cell.r + dr
      // La ruche compte comme construite : c'est elle qui amorce le rayon.
      if (q === 0 && r === 0 && !prev) return true
      const neighbor = COMB.find((c) => c.q === q && c.r === r)
      if (!neighbor || !this.comb.has(neighbor.id)) continue
      if (!prev || neighbor.kind === cell.kind) return true
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
    this.grantCellBees(cell)
    return true
  }

  /**
   * Verse les abeilles d'une alvéole (`CombCell.bees`).
   *
   * Les branches « butineuses » et « ouvrières » n'améliorent rien : elles
   * ajoutent un effectif. Une alvéole n'ouvre donc pas un achat, elle DONNE
   * l'abeille — le miel n'existait pas encore pour payer la première ouvrière, et
   * les suivantes se paient au rayon comme tout le reste.
   *
   * Séparé de l'achat parce que le menu de triche offre les alvéoles sans les
   * payer et doit produire exactement les mêmes effets.
   */
  grantCellBees(cell: CombCell): void {
    if (cell.bees === undefined) return
    if (cell.kind === 'foragers') this.bees.forager += cell.bees
    if (cell.kind === 'workers') this.bees.worker += cell.bees
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

  /**
   * Miel rendu par un lot : l'effectif d'ouvrières, puis la maturation.
   *
   * Arrondi au centième, la précision qu'affiche le gain flottant (`fmtFine`) :
   * un `+0.31` annoncé pour 0,3125 versé ferait mentir le compte du joueur, et
   * c'est le compte qui a raison.
   */
  get honeyPerBatch(): number {
    const ripening = 1 + this.levelOf('ripening') * UPGRADE_EFFECT.ripeningStep
    return Math.round(this.bees.worker * HONEY.honeyPerWorker * ripening * 100) / 100
  }

  /**
   * Nectar qu'un lot engage, l'économie déduite. Arrondi : ce montant est celui
   * que le joueur voit tomber en haut de l'écran, il n'a pas de décimales.
   */
  get nectarPerBatch(): number {
    const thrift = 1 - this.levelOf('thrift') * UPGRADE_EFFECT.thriftStep
    return Math.round(HONEY.nectarPerBatch * thrift)
  }

  /** Durée d'un lot, la ventilation déduite. */
  get batchMs(): number {
    return HONEY.batchMs / (1 + this.levelOf('fanning') * UPGRADE_EFFECT.fanningStep)
  }

  /** La ruche sait-elle transformer ? (au moins une ouvrière) */
  get canBrew(): boolean {
    return this.bees.worker > 0
  }

  /**
   * Coupe ou relance la transformation.
   *
   * Couper, c'est couper TOUT DE SUITE : le lot en cours est abandonné et son
   * nectar rendu à la réserve. Laisser le lot finir trahirait le geste — on
   * coupe justement parce qu'on a besoin de ce nectar, et on ne peut pas
   * demander au joueur d'attendre huit secondes pour que sa décision prenne
   * effet. Le rendu est plafonné : une réserve pleine ne déborde pas.
   */
  setBrewing(on: boolean): void {
    this.brewEnabled = on
    if (on || !this.brewing) return
    this.brewing = false
    this.brewProgress = 0
    this.nectar = Math.min(this.nectarCapacity, this.nectar + this.nectarPerBatch)
  }

  /**
   * Verse du miel et en tire la gelée royale : une dose tous les
   * `jellyThreshold` de miel gagné. Le reliquat est conservé (`honeySinceJelly`)
   * — sinon un lot à 0,25 ne compterait jamais pour rien.
   *
   * @returns la gelée royale gagnée à cette occasion (0 le plus souvent).
   */
  addHoney(amount: number): number {
    this.honey += amount
    if (this.honey > this.bestHoney) this.bestHoney = this.honey

    this.honeySinceJelly += amount
    let jelly = 0
    while (this.honeySinceJelly >= HONEY.jellyThreshold) {
      this.honeySinceJelly -= HONEY.jellyThreshold
      jelly += HONEY.jellyPerThreshold
    }
    this.royalJelly += jelly
    return jelly
  }

  /**
   * Transformation du nectar en miel (appelée chaque frame).
   *
   * Un lot est un engagement : les 100 nectar partent à l'allumage, pas à
   * l'arrivée. Faute de quoi, rien ne démarre — et ça redémarre tout seul dès
   * que la réserve repasse le seuil.
   *
   * @returns le gain du lot qui vient de se clore, pour que la scène l'annonce
   * au-dessus de la ruche. `null` tant qu'il ne se passe rien.
   */
  tickHoney(dt: number): { honey: number; jelly: number } | null {
    if (!this.canBrew) return null

    if (!this.brewing) {
      if (!this.brewEnabled) return null
      if (this.nectar < this.nectarPerBatch) return null
      this.nectar -= this.nectarPerBatch
      this.brewing = true
      this.brewProgress = 0
    }

    this.brewProgress += (dt * 1000) / this.batchMs
    if (this.brewProgress < 1) return null

    this.brewing = false
    this.brewProgress = 0
    const honey = this.honeyPerBatch
    return { honey, jelly: this.addHoney(honey) }
  }

  spendHoney(amount: number): boolean {
    if (this.honey < amount) return false
    this.honey -= amount
    return true
  }

  /**
   * Remet la partie à l'état d'un premier lancement.
   *
   * L'instance de `GameState` est un singleton qui survit aux scènes : effacer
   * la sauvegarde ne suffit pas, il faut aussi vider ce qui est en mémoire —
   * sans quoi un « Restart » depuis l'écran-titre relancerait une partie neuve
   * avec le miel de la précédente.
   */
  reset(): void {
    this.nectar = 0
    this.honey = 0
    this.royalJelly = 0
    this.bees = emptyPopulation()
    this.bestHoney = 0
    this.queens = 0
    this.route = null
    this.comb = new Set<string>()
    this.brewing = false
    this.brewProgress = 0
    this.honeySinceJelly = 0
    this.brewEnabled = true
  }

  save(): void {
    const data: SaveData = {
      version: GAME.version,
      nectar: this.nectar,
      honey: this.honey,
      royalJelly: this.royalJelly,
      bees: { ...this.bees },
      bestHoney: this.bestHoney,
      queens: this.queens,
      comb: [...this.comb],
      route: this.route,
      brewing: this.brewing,
      brewProgress: this.brewProgress,
      honeySinceJelly: this.honeySinceJelly,
      brewEnabled: this.brewEnabled,
    }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data))
    } catch {
      /* stockage indisponible (mode privé) : on ignore */
    }
  }

  /**
   * Relit la sauvegarde. Renvoie faux s'il n'y a rien à reprendre — l'appelant
   * se présente alors comme un premier lancement.
   *
   * **Aucune migration.** Une sauvegarde écrite par une autre version du jeu est
   * détruite : entre deux versions d'une jam, l'équilibrage, le rayon et les
   * mécaniques bougent trop pour qu'un état ancien reste jouable, et une partie
   * subtilement incohérente est pire qu'une partie neuve. La version est celle
   * de `package.json` : la faire monter suffit à invalider les sauvegardes.
   */
  load(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return false
      const data = JSON.parse(raw) as Partial<SaveData>
      if (data.version !== GAME.version) {
        GameState.clear()
        this.reset()
        return false
      }
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
      // Le nectar d'un lot en cours a déjà quitté la réserve : on reprend le
      // lot où il en était plutôt que de le perdre (ou de le rembourser).
      this.brewing = data.brewing ?? false
      this.brewProgress = Math.min(Math.max(data.brewProgress ?? 0, 0), 1)
      this.honeySinceJelly = data.honeySinceJelly ?? 0
      this.brewEnabled = data.brewEnabled ?? true
      // Un trajet tronqué ou abîmé est écarté plutôt que rejoué de travers :
      // le joueur retombe sur « aucun tour enregistré », ce qui se voit et se
      // répare, là où un trajet à moitié valide se rejoue en silence (cf.
      // `isValidRoute`).
      this.route = isValidRoute(data.route) ? data.route : null
      return true
    } catch {
      // Sauvegarde illisible : on a pu en appliquer une partie avant de casser.
      // On repart donc d'une partie propre plutôt que d'un état à moitié relu.
      this.reset()
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
