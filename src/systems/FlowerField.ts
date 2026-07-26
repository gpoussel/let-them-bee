// Calendrier des fleurs du pré.
//
// Règle absolue : le pré doit être RIGOUREUSEMENT le même à chaque essai — même
// partie, même relance, même enregistrement. Sans ça, comparer deux trajets au
// nectar par seconde n'a aucun sens : on comparerait de la chance.
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

/**
 * Espèce qui pousse sur l'emplacement `seed` à son `cycle`-ième tour.
 *
 * Une fleur ne repousse JAMAIS à l'identique : le pré se recompose à chaque
 * repousse, sinon on apprendrait le terrain une fois pour toutes et le tour
 * optimal se figerait. C'est un mélange de bits (façon xorshift), pas un
 * tirage : la suite est imprévisible à l'œil, mais entièrement reproductible —
 * la même graine et le même numéro de cycle donnent toujours la même fleur.
 */
function speciesAt(seed: number, cycle: number): number {
  let h = (seed ^ (cycle * 0x9e3779b1)) >>> 0
  h ^= h << 13
  h >>>= 0
  h ^= h >>> 17
  h ^= h << 5
  h >>>= 0
  return h % FLOWER_KINDS.length
}

/** Durée d'un cycle complet d'une espèce : pousse + floraison + repos. */
function periodOf(species: number): number {
  const kind = FLOWER_KINDS[species]
  return kind.grow + kind.life + FLOWER.restMs
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

export class FlowerField {
  readonly slots: Slot[] = []
  /** Cycle durant lequel chaque emplacement a déjà été butiné (-1 : jamais). */
  private readonly harvested: number[] = []
  /** Horloge du tour, en ms. */
  private t = 0

  /**
   * @param bounds zone où semer, en coordonnées monde
   * @param avoid  zone interdite (la ruche), en coordonnées monde
   */
  constructor(
    bounds: { left: number; top: number; right: number; bottom: number },
    avoid: { x: number; y: number; radius: number },
  ) {
    const rnd = random(FLOWER.seed)
    for (let i = 0; i < FLOWER.count; i++) {
      let x = 0
      let y = 0
      // Quelques essais suffisent : si l'emplacement tombe sur la ruche, on le
      // retire plutôt que de le pousser ailleurs — le tirage reste déterministe.
      let placed = false
      for (let tries = 0; tries < 12 && !placed; tries++) {
        x = bounds.left + rnd() * (bounds.right - bounds.left)
        y = bounds.top + 24 + rnd() * (bounds.bottom - bounds.top - 24)
        placed = Math.hypot(x - avoid.x, y - avoid.y) >= avoid.radius
      }
      if (!placed) continue

      const seed = Math.floor(rnd() * 0x7fffffff)
      const first = periodOf(speciesAt(seed, 0))
      this.slots.push({
        x: Math.round(x),
        y: Math.round(y),
        seed,
        offset: Math.floor(rnd() * first),
      })
      this.harvested.push(-1)
    }
  }

  /** Remet le pré à son état de départ. À appeler au début de CHAQUE tour. */
  reset(): void {
    this.t = 0
    this.harvested.fill(-1)
  }

  advance(deltaMs: number): void {
    this.t += deltaMs
  }

  /** État de l'emplacement `i` à l'instant courant. */
  stateOf(i: number): SlotState {
    const slot = this.slots[i]
    // Les cycles n'ont plus tous la même durée — une orchidée met trois fois
    // plus longtemps qu'une marguerite —, donc on les déroule depuis le début
    // du tour. C'est bon marché : un tour dure 10 s, un cycle jamais moins de
    // 5, cela fait deux ou trois pas.
    const { cycle, local } = this.cycleAt(slot, this.t)
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
      const period = periodOf(speciesAt(slot.seed, cycle))
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
    const perfect = state.freshness >= FLOWER.perfectFreshness
    const kind = FLOWER_KINDS[state.species]
    // Une corolle qui vient de s'ouvrir paie plein tarif ; une fleur sur le
    // point de faner ne rapporte presque plus, mais jamais rien.
    let nectar = Math.max(1, Math.round(FLOWER.baseNectar * kind.value * state.freshness))
    if (perfect) nectar *= FLOWER.perfectMultiplier
    return { nectar, perfect }
  }
}
