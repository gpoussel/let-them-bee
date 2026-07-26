// Planificateur de trajet — OUTIL DE DÉVELOPPEMENT.
//
// Il fabrique de toutes pièces un trajet correct (ruche → fleurs → ruche) pour
// ne pas avoir à en piloter un à la main chaque fois qu'on teste l'aval du jeu
// (production passive, rayon, prestige). Ce n'est pas un solveur : une gloutonne
// « meilleur nectar par seconde d'ici là », qui accepte d'attendre qu'une
// corolle s'ouvre. Elle rend un tour honnête, pas le tour optimal — et c'est
// très bien ainsi : le tour optimal reste à trouver par le joueur.
//
// Le trajet produit est du MÊME format que celui du joueur (positions
// échantillonnées à `ROUTE.sampleMs`) : rien ne le distingue à la relecture.

import { ROUTE } from '../config/balance'
import { type FlowerField, nectarFrom } from '../systems/FlowerField'
import type { Route } from '../systems/Route'

export interface PlanContext {
  /** Pré de SIMULATION (jamais celui qu'affiche la scène). */
  field: FlowerField
  /** Ruche : départ et arrivée du tour, en coordonnées monde. */
  hive: { x: number; y: number }
  /** Coin haut-gauche du pré : les trajets s'y rapportent (cf. systems/Route). */
  origin: { x: number; y: number }
  /** Hauteur de la corolle au-dessus de la base du pied. */
  reachRise: number
  /** Distance de butinage effective (rayon de l'abeille + tolérance de la scène). */
  forageRadius: number
  /** Vitesse de vol, en px/s (améliorations comprises). */
  speed: number
  /** Vitesse du calendrier des fleurs (améliorations comprises). */
  growthMult: number
}

/** Marge gardée sur le couperet des 10 s : un tour rasant se ferait couper. */
const SAFETY_MS = 400
/** Pas de recherche d'une date d'arrivée où la fleur sera ouverte. */
const WAIT_STEP_MS = ROUTE.sampleMs
/** Sur-place maximal devant une corolle qui n'a pas voulu s'ouvrir, en ms. */
const HOVER_CAP_MS = 1500

/**
 * Construit un trajet complet. Renvoie `null` si aucune fleur n'était à portée
 * dans le temps imparti (pré vide, vitesse absurde…).
 */
export function planRoute(ctx: PlanContext): Route | null {
  const { field, hive } = ctx
  const stepPx = (ctx.speed * ROUTE.sampleMs) / 1000
  const budget = ROUTE.maxDurationMs - SAFETY_MS

  field.reset()

  const pts: number[] = []
  let x = hive.x
  let y = hive.y
  let t = 0
  let nectar = 0
  let picked = 0

  const push = (): void => {
    pts.push(Math.round(x - ctx.origin.x), Math.round(y - ctx.origin.y))
  }

  /** Un pas de 50 ms : on avance, le pré avance, et on butine ce qu'on frôle. */
  const tick = (): void => {
    t += ROUTE.sampleMs
    field.advance(ROUTE.sampleMs * ctx.growthMult)
    push()
    // Même règle que la scène : tout ce qui passe à portée est butiné.
    field.slots.forEach((slot, i) => {
      const d = Math.hypot(x - slot.x, y - (slot.y - ctx.reachRise))
      if (d > ctx.forageRadius) return
      const got = field.harvest(i)
      if (got.nectar > 0) {
        nectar += got.nectar
        picked++
      }
    })
  }

  /** Temps de vol jusqu'à un point, en ms (multiple du pas d'échantillonnage). */
  const timeTo = (tx: number, ty: number, fromX = x, fromY = y): number =>
    Math.ceil(Math.hypot(tx - fromX, ty - fromY) / stepPx) * ROUTE.sampleMs

  /** Vole en ligne droite jusqu'au point, à vitesse maximale. */
  const flyTo = (tx: number, ty: number): void => {
    for (let guard = 0; guard < 1000; guard++) {
      const dx = tx - x
      const dy = ty - y
      const d = Math.hypot(dx, dy)
      if (d <= 0.5) return
      const s = Math.min(stepPx, d)
      x += (dx / d) * s
      y += (dy / d) * s
      tick()
    }
  }

  push()

  for (let guard = 0; guard < 64; guard++) {
    const remaining = budget - t
    interface Candidate {
      tx: number
      ty: number
      score: number
    }
    let best: Candidate | null = null

    for (let i = 0; i < field.slots.length; i++) {
      const slot = field.slots[i]
      const tx = slot.x
      const ty = slot.y - ctx.reachRise
      const eta = timeTo(tx, ty)
      const home = timeTo(hive.x, hive.y, tx, ty)
      // On cherche la PREMIÈRE date d'arrivée où la corolle sera ouverte :
      // c'est aussi la plus fraîche, donc la mieux payée.
      for (let wait = eta; wait + home <= remaining; wait += WAIT_STEP_MS) {
        const state = field.stateOf(i, field.now + wait * ctx.growthMult)
        if (state.phase !== 'bloom') continue
        const gain = nectarFrom(state).nectar
        if (gain <= 0) break
        const score = gain / wait
        if (!best || score > best.score) best = { tx, ty, score }
        break
      }
    }

    if (!best) break
    const before = picked
    flyTo(best.tx, best.ty)
    // Arrivé en avance : on fait du sur-place le temps que la corolle s'ouvre
    // (le butinage est vérifié à chaque pas).
    for (let waited = 0; picked === before && waited < HOVER_CAP_MS; waited += ROUTE.sampleMs) {
      if (t + timeTo(hive.x, hive.y) >= budget) break
      tick()
    }
  }

  if (picked === 0) return null

  // Retour à la ruche : c'est là que le tour se solde, à l'aller comme au
  // bouclage de la relecture.
  flyTo(hive.x, hive.y)

  const duration = (pts.length / 2 - 1) * ROUTE.sampleMs
  return { pts, duration, nectar }
}
