import {
  BEE,
  BEE_KINDS,
  FLOWER,
  getNectarCapacity,
  HIVE,
  HONEY,
  ROUTE,
  type BeeKindId,
} from '../config/balance'
import { GAME } from '../config/game'
import { LINEAGE, LINEAGE_EFFECT, type LineageKind, type LineageNode } from '../config/lineage'
import {
  CELL_BEE_KIND,
  cellAt,
  COMB,
  costRank,
  mainCurrency,
  NEIGHBORS,
  UPGRADE_EFFECT,
  type CombCell,
  type UpgradeKind,
} from '../config/upgrades'
import type { FieldTuning } from './FlowerField'
import { isBetter, isValidRoute, type Route } from './Route'

const SAVE_KEY = GAME.saveKey

/**
 * Ce que la dérive du vol garde après un cran de la branche « vol » (cf.
 * `beeDrift`). Six crans en laissent 65 % : assez pour que le premier achat se
 * sente, pas assez pour que le pilotage cesse d'être un métier.
 */
const DRIFT_PER_FLIGHT = 0.93

/**
 * Tire une graine de pré pour une partie neuve.
 *
 * C'est le SEUL vrai hasard du jeu, et il ne dure qu'un instant : une fois tiré,
 * il est écrit en sauvegarde et tout le reste redevient déterministe (cf.
 * `systems/rng`). `Math.random` convient donc ici, là où il n'a sa place nulle
 * part ailleurs — on ne cherche pas une suite reproductible, on cherche le
 * nombre qui rendra la suivante reproductible.
 *
 * Bornée à un entier positif de 31 bits : c'est ce que `random()` sait recevoir.
 */
function newFieldSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff)
}

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
  /**
   * GRAINE DU PRÉ. Tirée une fois, au premier lancement, et jamais retirée
   * ensuite : c'est elle qui décide où poussent les fleurs et ce qui y repousse.
   *
   * Elle DOIT être sauvegardée, et c'est tout l'enjeu du champ. Le pré est une
   * fonction pure du temps et de cette graine (cf. `FlowerField`) ; un trajet
   * enregistré ne vaut donc que sur SON pré. Une graine retirée à la relecture
   * rejouerait le meilleur tour du joueur sur un terrain qu'il n'a jamais vu —
   * la trajectoire passerait à côté de fleurs qui ne sont plus là, et le
   * « meilleur miel » du compteur deviendrait un score que rien ne reproduit.
   */
  fieldSeed: number
  /** Lot de transformation en cours : nectar déjà engagé, avancement (0..1). */
  brewing: boolean
  brewProgress: number
  /** Miel gagné depuis la dernière dose de gelée royale. */
  honeySinceJelly: number
  /** La transformation est-elle en marche (cf. `setBrewing`). */
  brewEnabled: boolean
  /** Meilleur trajet de butinage connu (cf. systems/Route). */
  route: Route | null
  /** Identifiants des nœuds de lignée acquis (cf. config/lineage). PERMANENT. */
  lineage: string[]
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
  /** Nœuds de lignée acquis. Ils SURVIVENT à l'essaimage (cf. `swarm`). */
  lineage = new Set<string>()
  /**
   * Graine du pré (cf. `SaveData.fieldSeed`). Tirée au premier lancement, puis
   * PORTÉE par la partie — sauvegarde, relance et essaimage compris.
   *
   * Elle survit à l'essaimage exprès : le pré est le terrain d'entraînement du
   * joueur, et une reine qui part fonder ailleurs n'a aucune raison d'effacer ce
   * qu'il a appris à voler. C'est aussi ce qui garde `bestHoney` comparable
   * d'une colonie à l'autre — le patrimoine se mesure sur un pré qui ne bouge
   * pas (cf. `resetColony`, qui ne la touche pas).
   */
  fieldSeed: number = FLOWER.seed

  // --- Le rayon (améliorations) -------------------------------------------

  /** Nombre d'alvéoles achetées dans une branche = son niveau. */
  levelOf(kind: UpgradeKind): number {
    let n = 0
    for (const cell of COMB) if (cell.kind === kind && this.comb.has(cell.id)) n++
    return n
  }

  /**
   * Une alvéole UNIQUE est-elle bâtie ? Les jalons et les pièges n'ont qu'un
   * rang : demander leur niveau n'aurait pas de sens, on demande s'ils sont là.
   */
  has(kind: UpgradeKind): boolean {
    return this.levelOf(kind) > 0
  }

  /** Contenance de la réserve, améliorations comprises (courbe quadratique). */
  get nectarCapacity(): number {
    return getNectarCapacity(this.levelOf('storage'))
  }

  /**
   * Multiplicateur de vitesse de vol de la butineuse.
   *
   * Deux branches y contribuent, ADDITIVEMENT : le vol du début de partie par
   * pas de 4 %, l'aérodynamisme par pas de 0,5 %. Additivement et non
   * multiplicativement, pour que la vingt-quatrième alvéole d'aérodynamisme pèse
   * exactement autant que la première — une branche de grind ne doit pas
   * s'emballer, elle doit durer.
   */
  get flightMult(): number {
    return (
      1 +
      this.levelOf('flight') * UPGRADE_EFFECT.flightStep +
      this.levelOf('aerodynamics') * UPGRADE_EFFECT.aeroStep
    )
  }

  /**
   * BUTINEUSES EFFECTIVES : celles qui volent le trajet, dessinées ou non.
   *
   * Aux abeilles réelles s'ajoutent les FANTÔMES — la Reine Mère en verse un par
   * cran, la Danse Frénétique un par tranche d'ouvrières. Ce ne sont pas des
   * abeilles : elles n'apparaissent pas dans les effectifs, elles ne coûtent
   * rien à nourrir, elles multiplient simplement ce que rapporte un tour. Le
   * jeu ne dessine de toute façon qu'une butineuse à l'écran, quelle que soit
   * leur nombre (cf. `GameScene.deposit`) : la fiction du fantôme ne coûte donc
   * rien à la lisibilité.
   */
  get foragerCount(): number {
    const ghosts = this.levelOf('queenMother') * UPGRADE_EFFECT.ghostPerQueenTier
    const dance = this.has('frenzyDance')
      ? Math.floor(this.bees.worker / UPGRADE_EFFECT.danceWorkersPerGhost)
      : 0
    return this.bees.forager + ghosts + dance
  }

  /**
   * PÉRIMÈTRE DE DÉPÔT, en px : la distance à la ruche à laquelle un tour se clôt.
   *
   * C'est la seule grandeur du jeu qui joue sur le DIVISEUR. Un tour est jugé au
   * nectar par seconde ; élargir la zone de dépôt ne fait pas rentrer un nectar
   * de plus, elle clôt le tour une fraction de seconde plus tôt. À butin égal, le
   * même trajet vaut donc mieux — mais SEULEMENT s'il est revolé : le trajet
   * enregistré, lui, a été volé jusqu'à l'ancien périmètre et garde sa durée.
   * C'est ce qui ramène le joueur à la souris en fin de partie, et c'est tout
   * l'objet des guerrières : elles ne se battent pas, elles tiennent l'espace.
   */
  get depositRadius(): number {
    return HIVE.depositRadius + this.bees.warrior * UPGRADE_EFFECT.guardRadiusPx
  }

  /** Nectar ADDITIF rapporté par un vol, quoi qu'il arrive (piège « Pollen lourd »). */
  get flatNectarPerLap(): number {
    return this.has('heavyPollen') ? UPGRADE_EFFECT.heavyPollenNectar : 0
  }

  /** Désaccord du son de butinage, en cents (cosmétique « Bourdonnement sourd »). */
  get forageDetune(): number {
    return this.has('dullBuzz') ? UPGRADE_EFFECT.dullBuzzDetune : 0
  }

  /** Multiplicateur de vitesse du calendrier des fleurs. */
  get growthMult(): number {
    return 1 + this.levelOf('growth') * UPGRADE_EFFECT.growthStep
  }

  owns(cell: CombCell): boolean {
    return this.comb.has(cell.id)
  }

  /**
   * Une alvéole se dévoile quand la cire arrive CONTRE elle : elle touche la
   * ruche, ou une alvéole payée. C'est tout, et c'est voulu — le rayon est une
   * carte, pas un arbre de compétences, et ce qu'on voit doit s'expliquer par ce
   * qu'on voit. Aucune règle ne nomme d'alvéole ni de rang : un ordre écrit
   * ailleurs que dans la géométrie serait invisible au joueur, et se casserait
   * au premier coude déplacé.
   *
   * L'ORDRE, c'est donc la FORME du rayon qui le fait. Une branche se parcourt
   * dans l'ordre parce que ses alvéoles se touchent ; l'ouvrière attend la
   * réserve à quatre paliers parce qu'elle est posée au bout de cette
   * branche-là, et rien d'autre ne la touche.
   *
   * SEULE exception, et elle ne parle pas d'alvéoles mais de MONNAIE : ce qui se
   * paie en miel n'apparaît pas tant que la ruche ne sait pas en faire. Les
   * alvéoles en miel touchent la ruche : sans ça, elles seraient là à la
   * première seconde, prix affiché dans une ressource qui n'existe pas encore.
   *
   * Le joueur ne voit donc jamais la carte entière, seulement le bord de sa ruche.
   */
  isRevealed(cell: CombCell): boolean {
    // Une alvéole HÉRITÉE (cf. `applyLineage`) est bâtie sans avoir été
    // dévoilée : elle se montre parce qu'elle existe, et c'est elle qui dévoile
    // ses voisines. Sans cette ligne, un héritage en miel disparaîtrait de
    // l'écran tant que la colonie neuve n'a pas d'ouvrière.
    if (this.comb.has(cell.id)) return true
    if (cell.cost.honey !== undefined && !this.canBrew) return false
    for (const [dq, dr] of NEIGHBORS) {
      const q = cell.q + dq
      const r = cell.r + dr
      // La ruche compte comme construite : c'est elle qui amorce le rayon.
      if (q === 0 && r === 0) return true
      const neighbor = cellAt(q, r)
      if (neighbor && this.comb.has(neighbor.id)) return true
    }
    return false
  }

  /**
   * La bourse suffit-elle ? Un prix mixte demande les DEUX monnaies à la fois :
   * il n'y a pas de conversion dans ce jeu, et une alvéole mixte ne s'achète pas
   * à moitié.
   */
  canAfford(cell: CombCell): boolean {
    return this.honey >= (cell.cost.honey ?? 0) && this.nectar >= (cell.cost.nectar ?? 0)
  }

  canBuy(cell: CombCell): boolean {
    return !this.owns(cell) && this.isRevealed(cell) && this.canAfford(cell)
  }

  /** Une alvéole visible et payable quelque part : le rayon a quelque chose à dire. */
  get combHasOffer(): boolean {
    return COMB.some((cell) => this.canBuy(cell))
  }

  /**
   * Lit une grandeur de la ruche COMME SI `cell` était bâtie, puis remet tout
   * en place.
   *
   * C'est ce qui permet au rayon d'annoncer « Workers 0 > 1 » au survol sans
   * recopier la moindre formule : on ne PRÉDIT pas l'effet d'une alvéole, on
   * l'applique pour de bon le temps d'une lecture. Une branche qui change de
   * formule ne peut donc pas faire mentir l'aperçu — c'est le même code qui
   * répond avant et après l'achat.
   *
   * Ce qui est posé ici est exactement ce que pose `buyCell`, prix mis à part :
   * l'alvéole et ses abeilles. Rien d'autre n'entre dans les grandeurs lues.
   */
  previewCell<T>(cell: CombCell, read: () => T): T {
    if (this.comb.has(cell.id)) return read()
    this.comb.add(cell.id)
    this.grantCellBees(cell)
    try {
      return read()
    } finally {
      this.comb.delete(cell.id)
      const kind = CELL_BEE_KIND[cell.kind]
      if (kind && cell.bees !== undefined) this.bees[kind] -= cell.bees
    }
  }

  /** Achète une alvéole dans SES monnaies. Renvoie faux si elle n'est pas à portée. */
  buyCell(cell: CombCell): boolean {
    if (!this.canBuy(cell)) return false
    this.honey -= cell.cost.honey ?? 0
    this.nectar -= cell.cost.nectar ?? 0
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
    const kind = CELL_BEE_KIND[cell.kind]
    if (!kind) return
    this.bees[kind] += cell.bees
  }

  // --- La lignée (prestige) -----------------------------------------------

  /** Nombre de paliers acquis dans une branche de la lignée = son niveau. */
  lineageLevel(kind: LineageKind): number {
    let n = 0
    for (const node of LINEAGE) if (node.kind === kind && this.lineage.has(node.id)) n++
    return n
  }

  ownsLineage(node: LineageNode): boolean {
    return this.lineage.has(node.id)
  }

  /** La gelée est-elle dépensable ? Il y faut une reine partie (cf. `swarm`). */
  get canSpendJelly(): boolean {
    return this.queens > 0
  }

  /**
   * Un nœud est ATTEIGNABLE quand le palier qui le précède dans sa branche est
   * acquis. Rien n'est caché ici, contrairement au rayon : la lignée est un plan
   * qu'on regarde entre deux colonies, et on doit pouvoir viser un rang III
   * depuis sa première reine — sinon on ne saurait pas pourquoi économiser.
   */
  lineageReachable(node: LineageNode): boolean {
    if (node.tier <= 1) return true
    return this.lineageLevel(node.kind) >= node.tier - 1
  }

  /**
   * La lignée n'écoute QUE les reines : rien ne s'y achète tant qu'aucune n'a
   * quitté la ruche. Après le premier essaimage, elle reste ouverte pour
   * toujours — la gelée se dépense quand le joueur le décide, pas dans une
   * fenêtre qui se referme. Un guichet qui n'ouvre qu'après un reset obligerait
   * à choisir vite, et à choisir mal.
   */
  canBuyLineage(node: LineageNode): boolean {
    return (
      this.canSpendJelly &&
      !this.ownsLineage(node) &&
      this.lineageReachable(node) &&
      this.royalJelly >= node.cost
    )
  }

  buyLineage(node: LineageNode): boolean {
    if (!this.canBuyLineage(node)) return false
    this.royalJelly -= node.cost
    this.lineage.add(node.id)
    // L'héritage s'applique TOUT DE SUITE : le joueur achète « Nectar Blood »
    // et voit son rayon se remplir derrière l'arbre. Un héritage versé plus tard
    // demanderait de se souvenir d'un état intermédiaire, et une sauvegarde
    // prise entre les deux serait fausse.
    this.applyLineage()
    return true
  }

  /**
   * Un nœud atteignable et payable quelque part : la lignée a quelque chose à
   * dire, et le bouton étoile s'allume à côté de la gelée royale.
   *
   * La condition ne regarde PAS `canSpendJelly` : avant la première reine, ce
   * qui est payable est justement l'appel à essaimer.
   */
  get lineageHasOffer(): boolean {
    return LINEAGE.some(
      (node) =>
        !this.ownsLineage(node) && this.lineageReachable(node) && this.royalJelly >= node.cost,
    )
  }

  /**
   * Verse au rayon les alvéoles dont la lignée dispense la colonie.
   *
   * Ce ne sont pas des alvéoles à part : ce sont EXACTEMENT celles du rayon, du
   * rang I au rang hérité, versées comme si elles avaient été payées (abeilles
   * comprises, cf. `grantCellBees`). La colonie ne dépasse donc jamais ce
   * qu'elle aurait pu bâtir seule — elle y arrive plus tôt.
   *
   * Idempotent : appelé à l'essaimage, à chaque achat de nœud et à la relecture
   * d'une sauvegarde, il ne verse jamais deux fois la même alvéole.
   */
  applyLineage(): void {
    const tiers: Record<string, number> = {
      nectar: this.lineageLevel('nectarBlood'),
      honey: this.lineageLevel('honeyBlood'),
    }
    for (const cell of COMB) {
      if (cell.tier > tiers[mainCurrency(cell)] || this.comb.has(cell.id)) continue
      this.comb.add(cell.id)
      this.grantCellBees(cell)
    }
  }

  // --- Ce que la lignée change dans le jeu ---------------------------------

  /** Le rayon s'achète-t-il en un geste ? (nœud `busyWax`) */
  get canBulkBuy(): boolean {
    return this.lineageLevel('busyWax') > 0
  }

  /**
   * Bâtit tout ce que la colonie peut s'offrir, DU MOINS CHER AU PLUS CHER.
   *
   * L'ordre n'est pas un détail : payer d'abord le plus cher laisserait des
   * alvéoles bon marché sur le carreau, alors que l'inverse en bâtit toujours au
   * moins autant. On recommence tant qu'il reste quelque chose parce qu'une
   * alvéole bâtie en dévoile d'autres — et parce que le nectar et le miel sont
   * deux bourses distinctes, qui ne se disputent pas le même achat.
   *
   * @returns le nombre d'alvéoles bâties.
   */
  buyAllAffordable(): number {
    if (!this.canBulkBuy) return 0
    let built = 0
    // La borne est le rayon entier : chaque tour bâtit exactement une alvéole,
    // il ne peut donc pas y en avoir plus que d'alvéoles.
    while (built < COMB.length) {
      const next = COMB.filter((cell) => this.canBuy(cell)).sort(
        (a, b) => costRank(a.cost) - costRank(b.cost),
      )[0]
      if (!next) break
      this.buyCell(next)
      built++
    }
    return built
  }

  /**
   * Multiplicateur du lissage de l'abeille : plus grand = moins d'inertie.
   *
   * L'INERTIE ZÉRO en supprime 95 % d'un coup. C'est le seul nœud du jeu qui
   * touche au geste lui-même, et c'est assumé : il ne rapporte rien, il rend
   * traçable le trajet que le joueur avait en tête et n'arrivait pas à voler. Il
   * coûte en conséquence — à ce prix-là, le joueur a déjà prouvé qu'il savait
   * piloter avec l'inertie.
   */
  get beeLerp(): number {
    const steady = LINEAGE_EFFECT.steadyLerpMult ** this.lineageLevel('steadyWings')
    const zero = this.has('zeroInertia') ? UPGRADE_EFFECT.zeroInertiaMult : 1
    return BEE.lerp * steady * zero
  }

  /**
   * Amplitude de la DÉRIVE du vol piloté, en multiple de `BEE.driftPx`.
   *
   * Elle vaut 1 sur une colonie nue, et elle FOND à mesure qu'on améliore le vol.
   * Deux facteurs, et ce sont exactement ceux qui tiennent l'abeille :
   *
   *   - le LISSAGE (`beeLerp`) : la dérive lui est inversement proportionnelle,
   *     donc « ailes sûres » et l'INERTIE ZÉRO l'effacent en même temps qu'ils
   *     effacent l'inertie — à l'inertie zéro il reste 5 % de flottement, ce qui
   *     revient à voler droit ;
   *   - la branche VOL : 7 % de dérive en moins par cran. C'est là que se gagne le
   *     sentiment de progrès, parce que c'est le premier achat que le joueur fait
   *     et qu'il le sent AU GESTE, pas dans un compteur.
   *
   * Un premier trajet se vole donc de travers, et c'est le sujet : le rayon ne
   * vend pas seulement des chiffres, il rend la main.
   */
  get beeDrift(): number {
    return (BEE.lerp / this.beeLerp) * DRIFT_PER_FLIGHT ** this.levelOf('flight')
  }

  /** Couperet du tour, rallonges de la lignée et de la frénésie comprises. */
  get maxLapMs(): number {
    return (
      ROUTE.maxDurationMs +
      this.lineageLevel('longDays') * LINEAGE_EFFECT.longDayMs +
      this.levelOf('frenzy') * UPGRADE_EFFECT.frenzyMs
    )
  }

  /**
   * Seuil de passage au rouge du compteur. C'est le couperet moins les deux
   * dernières secondes : allonger le tour déplace l'alarme avec lui, sinon le
   * compteur virerait au rouge trois secondes avant la fin.
   */
  get warnLapMs(): number {
    return this.maxLapMs - (ROUTE.maxDurationMs - ROUTE.warnMs)
  }

  /** Réglages du pré que la lignée décale (cf. systems/FlowerField). */
  get fieldTuning(): FieldTuning {
    return {
      count: FLOWER.count + this.lineageLevel('wideMeadow') * LINEAGE_EFFECT.meadowPerTier,
      restMs:
        FLOWER.restMs *
        LINEAGE_EFFECT.quickRootsMult ** this.lineageLevel('quickRoots') *
        UPGRADE_EFFECT.deepRootsMult ** this.levelOf('deepRoots'),
      baseNectar:
        FLOWER.baseNectar * LINEAGE_EFFECT.richBloomMult ** this.lineageLevel('richBloom'),
      perfectFreshness:
        FLOWER.perfectFreshness - this.lineageLevel('keenEye') * LINEAGE_EFFECT.keenEyeFreshness,
      // Les COROLLES MUTANTES font passer le « Perfect » de x2 à x3. Elles ne
      // touchent qu'au pilotage : un trajet qui ne cueille rien au bon moment
      // n'en tire pas un nectar de plus.
      perfectMultiplier: this.has('mutantCorollas')
        ? UPGRADE_EFFECT.mutantPerfect
        : FLOWER.perfectMultiplier,
    }
  }

  /**
   * L'ESSAIMAGE. La reine part avec un essaim, la ruche est laissée derrière.
   *
   * Tout ce qu'une colonie a bâti disparaît — nectar, miel, effectifs, rayon,
   * trajet. Ne traversent que la gelée royale, la lignée déjà acquise, le compte
   * des reines et le meilleur miel jamais atteint : le patrimoine, pas les murs.
   *
   * La colonie neuve reçoit son héritage IMMÉDIATEMENT (`applyLineage`) : le
   * joueur voit son rayon se bâtir derrière l'arbre à chaque nœud acheté.
   *
   * L'essaimage n'ouvre aucune fenêtre de dépense : il fait une reine, et c'est
   * la reine qui ouvre la lignée — définitivement (cf. `canSpendJelly`).
   */
  swarm(): void {
    // L'ESSAIMAGE DORÉ : la lignée emporte un dixième du miel. Il est relevé
    // AVANT la remise à zéro et reversé après — l'essaimage reste ce qu'il est
    // (tout est perdu), et ce nœud-là est l'unique exception, écrite en un seul
    // endroit. Il pousse à RETARDER le prestige : plus la ruche est riche au
    // moment du départ, plus la suivante démarre haut.
    const kept = this.has('goldenSwarm') ? this.honey * UPGRADE_EFFECT.goldenSwarmKeep : 0
    this.queens += 1
    this.resetColony()
    this.applyLineage()
    this.honey = kept
    this.save()
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
    // La MATURATION LENTE et la SYNERGIE OUVRIÈRE s'ajoutent chacune à leur
    // propre facteur, et les deux facteurs se multiplient : la maturation paie
    // le lot, la synergie paie l'ouvrière. Une ruche vide ne tire donc rien de
    // la synergie, ce qui est exactement ce que le mot veut dire.
    const slow = 1 + this.levelOf('slowRipening') * UPGRADE_EFFECT.slowHoneyStep
    const synergy = UPGRADE_EFFECT.synergyMult ** this.levelOf('synergy')
    return (
      Math.round(this.bees.worker * HONEY.honeyPerWorker * ripening * slow * synergy * 100) / 100
    )
  }

  /**
   * Nectar qu'un lot engage, l'économie déduite. Arrondi : ce montant est celui
   * que le joueur voit tomber en haut de l'écran, il n'a pas de décimales.
   */
  get nectarPerBatch(): number {
    const thrift = 1 - this.levelOf('thrift') * UPGRADE_EFFECT.thriftStep
    return Math.round(HONEY.nectarPerBatch * thrift)
  }

  /**
   * Durée d'un lot. Trois branches s'y disputent, et c'est le RÉGLAGE du jeu de
   * long terme : la ventilation et les micro-siestes la raccourcissent, la
   * maturation lente l'allonge en échange de miel. Le joueur qui achète tout
   * n'obtient donc pas « le meilleur » — il obtient ce qu'il a choisi.
   */
  get batchMs(): number {
    const fanning = 1 + this.levelOf('fanning') * UPGRADE_EFFECT.fanningStep
    const naps = UPGRADE_EFFECT.microNapMult ** this.levelOf('microNaps')
    const slow = 1 + this.levelOf('slowRipening') * UPGRADE_EFFECT.slowBatchStep
    return (HONEY.batchMs / fanning) * naps * slow
  }

  /**
   * Miel qu'il faut accumuler pour une dose de gelée royale. La DIGESTION ROYALE
   * l'abaisse de 20 %, donc toute la lignée avance d'un cinquième plus vite —
   * c'est le seul nœud du rayon qui accélère le méta-jeu, et il se paie au
   * plafond de nectar.
   */
  get jellyThreshold(): number {
    return HONEY.jellyThreshold * (this.has('royalDigestion') ? UPGRADE_EFFECT.digestionMult : 1)
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
    const threshold = this.jellyThreshold
    while (this.honeySinceJelly >= threshold) {
      this.honeySinceJelly -= threshold
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
    this.resetColony()
    // Le patrimoine part avec le reste : ceci est un PREMIER LANCEMENT, pas un
    // essaimage (cf. `swarm`, qui appelle `resetColony` seul).
    this.royalJelly = 0
    this.bestHoney = 0
    this.queens = 0
    this.lineage = new Set<string>()
    // NOUVEAU PRÉ. C'est ici, et nulle part ailleurs, que la graine est tirée :
    // un premier lancement change de terrain, un essaimage non (cf.
    // `resetColony`). Le joueur qui recommence pour de bon retrouve un pré à
    // apprendre plutôt que celui qu'il connaissait par cœur.
    this.fieldSeed = newFieldSeed()
  }

  /**
   * Efface la COLONIE et rien d'autre : ce qu'une ruche contient et ce qu'elle a
   * bâti. C'est la part commune au premier lancement et à l'essaimage — la gelée
   * royale, la lignée, les reines et le meilleur miel n'y figurent pas, et c'est
   * tout l'objet de cette découpe.
   */
  private resetColony(): void {
    this.nectar = 0
    this.honey = 0
    this.bees = emptyPopulation()
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
      fieldSeed: this.fieldSeed,
      route: this.route,
      brewing: this.brewing,
      brewProgress: this.brewProgress,
      honeySinceJelly: this.honeySinceJelly,
      brewEnabled: this.brewEnabled,
      lineage: [...this.lineage],
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
      // Rien à reprendre : c'est un PREMIER LANCEMENT, et il lui faut son pré.
      // `reset` tire la graine, mais il n'est appelé que sur un « Restart »
      // explicite — sans cette ligne, une toute première partie pousserait sur
      // la graine de `FLOWER`, la même pour tout le monde.
      if (!raw) {
        this.fieldSeed = newFieldSeed()
        return false
      }
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
      // Une graine absente ou aberrante (sauvegarde bricolée) retombe sur celle
      // de `FLOWER` plutôt que d'être retirée : mieux vaut un pré connu qu'un
      // pré neuf sous un trajet enregistré pour un autre.
      this.fieldSeed =
        typeof data.fieldSeed === 'number' && Number.isFinite(data.fieldSeed)
          ? data.fieldSeed
          : FLOWER.seed
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
      // Même garde que pour le rayon : un nœud de lignée dont l'identifiant a
      // disparu de l'arbre n'est pas ressuscité.
      const lineage = Array.isArray(data.lineage) ? data.lineage : []
      this.lineage = new Set(lineage.filter((id) => LINEAGE.some((n) => n.id === id)))
      // L'héritage est REVERSÉ à la relecture. Il ne change rien dans le cas
      // normal (les alvéoles sont déjà en sauvegarde), mais il rattrape la
      // sauvegarde prise juste après un achat de nœud, et il garantit qu'un
      // rayon relu ne soit jamais en dessous de ce que la lignée promet.
      this.applyLineage()
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
