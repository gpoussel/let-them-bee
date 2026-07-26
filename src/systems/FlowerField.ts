// Calendrier des fleurs du pré.
//
// Règle absolue : le pré doit être RIGOUREUSEMENT le même à chaque essai — même
// partie, même relance, même enregistrement. Sans ça, comparer deux trajets au
// nectar par seconde n'a aucun sens : on comparerait de la chance.
//
// « Même partie » est à prendre au mot : le pré change d'UNE PARTIE À L'AUTRE, et
// seulement là. Sa graine est tirée au premier lancement puis SAUVEGARDÉE (cf.
// `SaveData.fieldSeed`) — deux joueurs n'apprennent pas le même terrain, et un
// même joueur retrouve le sien intact à chaque retour. Un pré figé dans le code
// faisait du meilleur trajet une solution unique qui se transmettait ; un pré
// retiré à chaque lancement aurait fait de l'enregistrement une loterie. La
// graine persistée est le seul point entre les deux.
//
// D'où la conception : l'état d'un emplacement est une FONCTION PURE du temps
// écoulé depuis le début du tour. Rien ne s'accumule, rien ne dérive, et
// remettre l'horloge à zéro suffit à retrouver le pré au pixel et à la
// milliseconde près. Les positions et les décalages sont tirés une fois, avec
// une graine fixe : le hasard est dans l'apparence, pas dans le déroulé.
//
// Le butinage lui-même ne déplace pas le calendrier : une fleur récoltée est
// simplement épuisée jusqu'à la fin de SA floraison, puis reprend son cycle à
// l'heure prévue. Le trajet du joueur ne peut donc pas décaler le terrain.

import { FLOWER, FLOWER_KINDS } from '../config/balance'
import { random } from './rng'

/** Tirages accordés à un emplacement avant qu'on le repousse de force. */
const PLACE_TRIES = 64

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/**
 * Les quatre réglages du pré que la LIGNÉE décale (cf. config/lineage).
 *
 * Ils sont passés au pré plutôt que lus dans `FLOWER` : le pré est un système
 * pur, il sert aussi bien la scène que la simulation des outils de dev, et il ne
 * doit connaître ni `GameState` ni le prestige. C'est l'appelant qui lui dit
 * dans quel monde il pousse.
 */
export interface FieldTuning {
  /** Nombre d'emplacements à semer. */
  count: number
  /** Temps mort entre la disparition d'une fleur et la repousse suivante, en ms. */
  restMs: number
  /** Nectar d'une corolle tout juste ouverte, avant le facteur d'espèce. */
  baseNectar: number
  /** Fraîcheur au-delà de laquelle la récolte est « Perfect ». */
  perfectFreshness: number
  /** Ce que vaut un « Perfect » (x2, ou x3 avec les corolles mutantes). */
  perfectMultiplier: number
}

/** Le pré tel que `config/balance` le décrit, sans aucun héritage. */
export const BASE_TUNING: FieldTuning = {
  count: FLOWER.count,
  restMs: FLOWER.restMs,
  baseNectar: FLOWER.baseNectar,
  perfectFreshness: FLOWER.perfectFreshness,
  perfectMultiplier: FLOWER.perfectMultiplier,
}

/**
 * Espèce qui pousse sur l'emplacement `seed` à son `cycle`-ième tour.
 *
 * Une fleur ne repousse JAMAIS à l'identique : le pré se recompose à chaque
 * repousse, sinon on apprendrait le terrain une fois pour toutes et le tour
 * optimal se figerait. C'est un mélange de bits (façon xorshift), pas un
 * tirage : la suite est imprévisible à l'œil, mais entièrement reproductible —
 * la même graine et le même numéro de cycle donnent toujours la même fleur.
 *
 * Mais l'espèce n'est pas TIRÉE à chaque cycle : elle est PIOCHÉE dans un sac.
 * Les huit espèces sont battues, puis servies une par une ; le sac se rebat
 * quand il est vide. Un emplacement voit donc chaque espèce exactement une fois
 * par tranche de huit cycles — jamais quatre orchidées d'affilée, jamais une
 * série de marguerites. Un tirage indépendant laissait la QUALITÉ du pré varier
 * d'une partie à l'autre : à dix-neuf emplacements, une graine malheureuse
 * semait un pré pauvre pour toute la partie, et le gain espéré d'un bon trajet
 * n'était plus le même pour deux joueurs. Avec le sac, la composition du pré est
 * la même pour tout le monde ; ce que la graine décide, c'est seulement OÙ et
 * QUAND — le hasard reste dans la géographie, pas dans le butin.
 */
function speciesAt(seed: number, cycle: number): number {
  const n = FLOWER_KINDS.length
  // Numéro du sac, et rang du tirage dans ce sac.
  const bagIndex = Math.floor(cycle / n)
  const draw = cycle - bagIndex * n

  // Un sac se bat avec sa propre suite de bits : deux sacs du même emplacement
  // ne se ressemblent pas, et le même sac se rebat toujours à l'identique.
  let h = (seed ^ (bagIndex * 0x9e3779b1) ^ 0x2545f491) >>> 0
  if (h === 0) h = 0x9e3779b1 // xorshift resterait bloqué sur zéro
  const next = (): number => {
    h ^= h << 13
    h >>>= 0
    h ^= h >>> 17
    h ^= h << 5
    h >>>= 0
    return h
  }

  const bag = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = next() % (i + 1)
    const swap = bag[i]
    bag[i] = bag[j]
    bag[j] = swap
  }
  return bag[draw]
}

/** Durée d'un cycle complet d'une espèce : pousse + floraison + repos. */
function periodOf(species: number, restMs: number): number {
  const kind = FLOWER_KINDS[species]
  return kind.grow + kind.life + restMs
}

/** Un emplacement du pré : une position, fixée une fois pour toutes. */
export interface Slot {
  x: number
  y: number
  /** Graine propre à l'emplacement : elle détermine ce qui y repousse, cycle après cycle. */
  seed: number
  /** Avance de l'emplacement au démarrage, en ms : les fleurs ne s'ouvrent pas toutes ensemble. */
  offset: number
}

/** Ce qu'un emplacement montre à un instant donné. */
export interface SlotState {
  /** `bud` : en train de pousser ; `bloom` : ouverte ; `gone` : rien à voir. */
  phase: 'bud' | 'bloom' | 'gone'
  /** Espèce du cycle en cours : elle change à chaque repousse. */
  species: number
  /** Avancement de la pousse, de 0 à 1 (phase `bud`). */
  growth: number
  /** Fraîcheur de la corolle, de 1 (vient de s'ouvrir) à 0 (fanée). */
  freshness: number
  /** Numéro du cycle en cours : sert à ne récolter qu'une fois par floraison. */
  cycle: number
}

/**
 * Ce que rapporterait un emplacement dans cet état. Pur : sert aussi bien à la
 * récolte qu'à l'ANTICIPER (cf. `stateOf(i, at)`).
 */
export function nectarFrom(
  state: SlotState,
  tuning: FieldTuning = BASE_TUNING,
): { nectar: number; perfect: boolean } {
  if (state.phase !== 'bloom') return { nectar: 0, perfect: false }
  const perfect = state.freshness >= tuning.perfectFreshness
  const kind = FLOWER_KINDS[state.species]
  // Une corolle qui vient de s'ouvrir paie plein tarif ; une fleur sur le
  // point de faner ne rapporte presque plus, mais jamais rien.
  let nectar = Math.max(1, Math.round(tuning.baseNectar * kind.value * state.freshness))
  if (perfect) nectar *= tuning.perfectMultiplier
  return { nectar, perfect }
}

export class FlowerField {
  readonly slots: Slot[] = []
  /** Cycle durant lequel chaque emplacement a déjà été butiné (-1 : jamais). */
  private readonly harvested: number[] = []
  /** Horloge du tour, en ms. */
  private t = 0

  /**
   * @param bounds zone où semer, en coordonnées monde
   * @param avoid  zone interdite (la ruche), en coordonnées monde
   * @param tuning réglages décalés par la lignée (cf. {@link FieldTuning})
   * @param seed   graine de la partie (cf. `SaveData.fieldSeed`) : elle fixe où
   *               les fleurs poussent ET ce qui y repousse, cycle après cycle
   *
   * Les fleurs supplémentaires de la lignée sont semées EN PLUS des autres, avec
   * le même tirage : les dix-neuf premiers emplacements d'un pré à vingt-deux
   * fleurs sont rigoureusement ceux d'un pré à dix-neuf. Un héritage n'invalide donc pas
   * le trajet de la colonie précédente, il lui ajoute des corolles.
   */
  constructor(
    bounds: { left: number; top: number; right: number; bottom: number },
    avoid: { x: number; y: number; radius: number },
    readonly tuning: FieldTuning = BASE_TUNING,
    seed: number = FLOWER.seed,
  ) {
    const rnd = random(seed)
    for (let i = 0; i < tuning.count; i++) {
      let x = 0
      let y = 0
      // La ruche est AU MILIEU du pré : un tirage sur trois environ y tombe. On
      // retire donc tant qu'il faut au lieu d'abandonner l'emplacement — sans
      // quoi le pré perdrait le tiers de ses fleurs, et pas toujours les mêmes
      // selon les réglages. Le tirage reste déterministe : c'est la MÊME suite
      // pseudo-aléatoire, on en consomme simplement les termes jusqu'au premier
      // qui convienne. Au bout de `TRIES`, l'emplacement est REPOUSSÉ hors de la
      // clairière en ligne droite depuis la ruche : ça ne se produit pas avec le
      // pré actuel, mais un pré étroit ne doit pas boucler ni perdre une fleur.
      let placed = false
      for (let tries = 0; tries < PLACE_TRIES && !placed; tries++) {
        x = bounds.left + rnd() * (bounds.right - bounds.left)
        y = bounds.top + 24 + rnd() * (bounds.bottom - bounds.top - 24)
        placed = Math.hypot(x - avoid.x, y - avoid.y) >= avoid.radius
      }
      if (!placed) {
        const len = Math.hypot(x - avoid.x, y - avoid.y)
        // Emplacement pile sur la ruche : on pousse vers la droite, faute de cap.
        const ux = len === 0 ? 1 : (x - avoid.x) / len
        const uy = len === 0 ? 0 : (y - avoid.y) / len
        x = clamp(avoid.x + ux * avoid.radius, bounds.left, bounds.right)
        y = clamp(avoid.y + uy * avoid.radius, bounds.top + 24, bounds.bottom)
      }

      const seed = Math.floor(rnd() * 0x7fffffff)
      const first = periodOf(speciesAt(seed, 0), tuning.restMs)
      this.slots.push({
        x: Math.round(x),
        y: Math.round(y),
        seed,
        offset: Math.floor(rnd() * first),
      })
      this.harvested.push(-1)
    }
  }

  /** Horloge du tour, en ms. Permet de lire le pré à une date FUTURE. */
  get now(): number {
    return this.t
  }

  /** Remet le pré à son état de départ. À appeler au début de CHAQUE tour. */
  reset(): void {
    this.t = 0
    this.harvested.fill(-1)
  }

  advance(deltaMs: number): void {
    this.t += deltaMs
  }

  /**
   * État de l'emplacement `i` à l'instant courant — ou à la date `at` (en ms
   * d'horloge du tour), ce qui permet de PRÉVOIR le pré sans l'avancer.
   */
  stateOf(i: number, at: number = this.t): SlotState {
    const slot = this.slots[i]
    // Les cycles n'ont plus tous la même durée — une orchidée met près de trois
    // fois plus longtemps à venir qu'une marguerite —, donc on les déroule
    // depuis le début du tour. C'est bon marché : un tour dure 10 s, un cycle
    // jamais moins de 7,5, cela fait un ou deux pas.
    const { cycle, local } = this.cycleAt(slot, at)
    const species = speciesAt(slot.seed, cycle)
    const kind = FLOWER_KINDS[species]
    const base = { species, cycle }

    if (local < kind.grow) {
      return { ...base, phase: 'bud', growth: local / kind.grow, freshness: 1 }
    }
    const age = local - kind.grow
    if (age < kind.life) {
      // Déjà butinée durant CETTE floraison : la fleur a donné, elle disparaît
      // jusqu'à la repousse — sans décaler le calendrier pour autant.
      if (this.harvested[i] === cycle) {
        return { ...base, phase: 'gone', growth: 1, freshness: 0 }
      }
      return { ...base, phase: 'bloom', growth: 1, freshness: 1 - age / kind.life }
    }
    return { ...base, phase: 'gone', growth: 1, freshness: 0 }
  }

  /** Cycle en cours d'un emplacement à l'instant `t`, et le temps écoulé dedans. */
  private cycleAt(slot: Slot, t: number): { cycle: number; local: number } {
    let local = t + slot.offset
    let cycle = 0
    // Borne de sûreté : une durée de cycle est toujours strictement positive,
    // la boucle ne peut donc pas s'emballer — mais on ne le parie pas.
    for (let guard = 0; guard < 4096; guard++) {
      const period = periodOf(speciesAt(slot.seed, cycle), this.tuning.restMs)
      if (local < period) break
      local -= period
      cycle++
    }
    return { cycle, local }
  }

  /**
   * Butine l'emplacement `i`. Renvoie le nectar récolté (0 si rien à prendre)
   * et si la fleur a été cueillie à peine ouverte.
   */
  harvest(i: number): { nectar: number; perfect: boolean } {
    const state = this.stateOf(i)
    if (state.phase !== 'bloom') return { nectar: 0, perfect: false }

    this.harvested[i] = state.cycle
    return nectarFrom(state, this.tuning)
  }
}
