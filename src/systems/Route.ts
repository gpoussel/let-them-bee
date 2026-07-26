// Trajet de butinage — l'itération unitaire du jeu.
//
// Le pilotage à la souris n'est PAS le jeu : c'est un enregistrement. Le joueur
// vole un tour (ruche → fleurs → ruche), ce tour est mémorisé, et sa butineuse
// le refait ensuite en boucle, indéfiniment, sans lui. Rejouer un tour n'est
// qu'un moyen d'en proposer un meilleur.
//
// Un trajet n'est retenu que s'il RAPPORTE PLUS PAR SECONDE que le précédent :
// c'est le seul critère. Un tour plus long peut donc gagner s'il récolte assez.
//
// Format : les positions sont échantillonnées à pas fixe (`ROUTE.sampleMs`), on
// n'a donc pas besoin de stocker le temps de chaque point. Elles sont relatives
// au coin haut-gauche du pré et arrondies au pixel — le trajet reste valable si
// le pré change de place, et la sauvegarde reste compacte.

import { ROUTE } from '../config/balance'

export interface Route {
  /** Positions relatives au pré, aplaties : [x0, y0, x1, y1, …]. */
  pts: number[]
  /** Durée du tour, en ms. */
  duration: number
  /** Nectar déposé à la ruche au terme du tour. */
  nectar: number
}

/** Le critère de comparaison entre deux trajets : nectar par seconde. */
export function routeRate(route: Route): number {
  return route.duration > 0 ? (route.nectar * 1000) / route.duration : 0
}

/** Un trajet remplace-t-il le précédent ? (Le premier gagne toujours.) */
export function isBetter(candidate: Route, best: Route | null): boolean {
  return best === null || routeRate(candidate) > routeRate(best)
}

/**
 * Un trajet est-il exploitable ?
 *
 * Le piège est une coordonnée NON FINIE. `JSON.stringify` ne sait pas écrire
 * `NaN` : il l'écrit `null`, qui se relit en `null` et vaut **zéro** dans
 * l'addition avec l'origine du pré. Un trajet ainsi abîmé ne se voit pas — il se
 * charge, il se rejoue, et la butineuse reste plantée au coin haut-gauche du pré
 * sans bouger, pour un tour entier. C'est pire qu'un trajet refusé : le joueur
 * croit son enregistrement perdu alors que le jeu le rejoue en silence.
 *
 * On vérifie donc les points un par un, aux deux bouts : à l'enregistrement pour
 * ne jamais écrire ça, et à la relecture pour ne jamais rejouer ce qui aurait
 * déjà été écrit.
 */
export function isValidRoute(route: Route | null | undefined): route is Route {
  if (!route || !Array.isArray(route.pts)) return false
  // Longueur paire : les points sont aplatis par couples (x, y).
  if (route.pts.length < 4 || route.pts.length % 2 !== 0) return false
  if (!Number.isFinite(route.duration) || route.duration <= 0) return false
  return route.pts.every((v) => Number.isFinite(v))
}

/**
 * Enregistreur : échantillonne la position de la butineuse à pas fixe pendant
 * que le joueur la pilote.
 */
export class RouteRecorder {
  private readonly pts: number[] = []
  private elapsed = 0
  /** Temps écoulé depuis le dernier point retenu. */
  private sinceSample = 0

  /**
   * @param maxDurationMs couperet du tour. Il est passé plutôt que lu dans
   * `ROUTE` : la lignée le rallonge (cf. `GameState.maxLapMs`), et
   * l'enregistreur n'a pas à savoir d'où vient la seconde supplémentaire.
   */
  constructor(
    private readonly originX: number,
    private readonly originY: number,
    private readonly maxDurationMs: number = ROUTE.maxDurationMs,
  ) {}

  get durationMs(): number {
    return this.elapsed
  }

  /** L'enregistrement a-t-il dépassé la durée maximale ? */
  get overrun(): boolean {
    return this.elapsed >= this.maxDurationMs
  }

  /** À appeler chaque frame avec la position courante de l'abeille. */
  sample(x: number, y: number, deltaMs: number): void {
    if (this.pts.length === 0) this.push(x, y)
    this.elapsed += deltaMs
    this.sinceSample += deltaMs
    while (this.sinceSample >= ROUTE.sampleMs) {
      this.sinceSample -= ROUTE.sampleMs
      this.push(x, y)
    }
  }

  private push(x: number, y: number): void {
    // Position non finie (cf. `isValidRoute`) : on retombe sur le dernier point
    // valable plutôt que d'empoisonner le trajet. Tant qu'il n'y en a aucun, on
    // n'écrit rien — un trajet qui commence par du néant ne commence pas.
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      const n = this.pts.length
      if (n >= 2) this.pts.push(this.pts[n - 2], this.pts[n - 1])
      return
    }
    this.pts.push(Math.round(x - this.originX), Math.round(y - this.originY))
  }

  /**
   * Clôt le tour. Renvoie `null` si le tour ne vaut pas un trajet.
   *
   * Un tour qui RAPPORTE est toujours un tour valable, même bouclé en une
   * seconde : c'est même le meilleur des cas, puisque le critère est le nectar
   * par seconde. Seul le tour BREDOUILLE doit durer un minimum pour compter —
   * sinon un aller-retour vide s'installerait comme premier trajet de référence
   * (le premier gagne toujours).
   */
  finish(nectar: number): Route | null {
    if (this.pts.length < 4) return null
    if (nectar <= 0 && this.elapsed < ROUTE.minDurationMs) return null
    // La durée retenue est celle des points effectivement enregistrés : c'est
    // elle que la relecture mettra à reproduire.
    const duration = (this.pts.length / 2 - 1) * ROUTE.sampleMs
    const route = { pts: [...this.pts], duration, nectar }
    // Dernier filet : un tour qu'on ne saurait pas rejouer n'est pas un tour.
    return isValidRoute(route) ? route : null
  }
}

/** Lecteur : rejoue un trajet en boucle et rend la position interpolée. */
export class RoutePlayer {
  private t = 0
  private readonly count: number

  constructor(
    private readonly route: Route,
    private readonly originX: number,
    private readonly originY: number,
  ) {
    this.count = route.pts.length / 2
  }

  /** Progression dans le tour courant, de 0 à 1. */
  get progress(): number {
    return this.route.duration > 0 ? this.t / this.route.duration : 0
  }

  /**
   * Avance de `deltaMs` et renvoie la position à atteindre, plus `looped` :
   * vrai sur la frame où le tour vient de repartir de zéro (c'est là que la
   * scène solde le tour précédent).
   */
  advance(deltaMs: number): { x: number; y: number; looped: boolean } {
    this.t += deltaMs
    let looped = false
    while (this.t >= this.route.duration && this.route.duration > 0) {
      this.t -= this.route.duration
      looped = true
    }

    const pos = this.t / ROUTE.sampleMs
    const i = Math.min(this.count - 1, Math.floor(pos))
    const j = Math.min(this.count - 1, i + 1)
    const f = pos - i
    const { pts } = this.route
    return {
      x: this.originX + pts[i * 2] + (pts[j * 2] - pts[i * 2]) * f,
      y: this.originY + pts[i * 2 + 1] + (pts[j * 2 + 1] - pts[i * 2 + 1]) * f,
      looped,
    }
  }
}
