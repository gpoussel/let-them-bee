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
 * Enregistreur : échantillonne la position de la butineuse à pas fixe pendant
 * que le joueur la pilote.
 */
export class RouteRecorder {
  private readonly pts: number[] = []
  private elapsed = 0
  /** Temps écoulé depuis le dernier point retenu. */
  private sinceSample = 0

  constructor(
    private readonly originX: number,
    private readonly originY: number,
  ) {}

  get durationMs(): number {
    return this.elapsed
  }

  /** L'enregistrement a-t-il dépassé la durée maximale ? */
  get overrun(): boolean {
    return this.elapsed >= ROUTE.maxDurationMs
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
    return { pts: [...this.pts], duration, nectar }
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
