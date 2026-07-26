// Le RAYON : l'arbre d'améliorations, bâti alvéole par alvéole.
//
// Il n'y a pas de « nœud à trois niveaux » ici : chaque niveau EST une alvéole,
// posée contre la précédente. C'est ce qui fait du rayon une ruche qui s'étend
// plutôt qu'une liste de compteurs — on ne monte pas un niveau, on colle une
// cire de plus au bord du rayon. C'est aussi ce qui rend le dévoilement lisible :
// acheter une case ouvre ses voisines, et rien d'autre.
//
// Coordonnées AXIALES (q, r), hexagones POINTE EN HAUT :
//   x = R * sqrt(3) * (q + r/2)      y = R * 3/2 * r
// L'alvéole (0, 0) est la ruche elle-même : elle ne s'achète pas, et c'est
// d'elle que part le dévoilement.

import { getNectarCapacity } from './balance'

/**
 * Les branches du rayon. Une branche = un effet, plusieurs alvéoles.
 *
 * Les trois dernières (`fanning`, `thrift`, `ripening`) ne touchent pas au vol :
 * elles règlent la TRANSFORMATION (cf. `HONEY`), et se paient donc dans ce
 * qu'elle produit.
 */
export type UpgradeKind =
  'storage' | 'foragers' | 'flight' | 'growth' | 'workers' | 'fanning' | 'thrift' | 'ripening'

/** Monnaie d'une alvéole. Le rayon en accepte deux, et le dit par son icône. */
export type Currency = 'nectar' | 'honey'

export interface CombCell {
  /** Identifiant stable, persisté en sauvegarde (`storage-2`, `flight-1`…). */
  id: string
  kind: UpgradeKind
  /** Rang dans sa branche, à partir de 1. Sert au libellé (I, II, III, IV). */
  tier: number
  /** Prix, dans la monnaie ci-dessous. Une alvéole s'achète une fois, et pour de bon. */
  cost: number
  currency: Currency
  q: number
  r: number
  /**
   * Abeilles DONNÉES par l'alvéole (branches `foragers` et `workers`). Ces deux
   * branches n'améliorent rien : elles ajoutent un effectif, et la quantité se
   * lit ici plutôt que dans une table à part.
   */
  bees?: number
}

/**
 * Nombre d'alvéoles de la branche « réserve ». C'est la plus longue du rayon,
 * mais elle reste COURTE : quinze paliers (« Storage I » à « Storage XV »). Une
 * branche de cinquante alvéoles se lisait comme une corvée — cinquante clics dont
 * chacun ne pesait presque rien. Quinze paliers sur une courbe raide font le
 * contraire : peu de décisions, chacune coûteuse (voir `getNectarCapacity` et
 * `storageCost`).
 */
export const STORAGE_TIERS = 15

/**
 * Prix d'une alvéole « réserve » : `A n² + B n + C`.
 *
 * Ces trois coefficients ne sont pas libres : ils doivent tenir sous la RÈGLE
 * D'OR (cf. `storageCost`). Ceux-ci sont exactement les TROIS QUARTS de la
 * contenance du rang précédent — `0,75 × (200 n² - 300 n + 200)` — c'est-à-dire le
 * prix le plus dur que la règle autorise sans jamais s'en approcher : chaque
 * alvéole coûte les trois quarts d'une réserve pleine, la marge restante est le
 * quart, et elle est positive pour TOUT n par construction. Il n'y a pas de rang
 * où la branche se referme sur elle-même.
 */
const STORAGE_COST = { a: 150, b: -225, c: 150 } as const

/**
 * Écart minimal, en nectar, entre le prix d'une alvéole « réserve » et le plafond
 * qui doit la payer. Un prix ÉGAL au plafond serait payable en théorie
 * (`nectar >= cost` à réserve pleine) mais illisible en pratique : le joueur
 * regarderait sa jauge saturée en se demandant s'il lui manque quelque chose.
 */
const SOFTLOCK_MARGIN = 10

/**
 * RÈGLE D'OR ANTI-BLOCAGE. Le prix de l'alvéole de rang `n` doit rester sous la
 * contenance qu'offre le rang `n - 1` : le nectar est plafonné, une alvéole plus
 * chère que la réserve du moment est inatteignable À JAMAIS, et comme c'est la
 * branche « réserve » qui relève le plafond, un seul rang trop cher fige tout le
 * rayon du vol.
 *
 * La formule quadratique ci-dessus la respecte d'elle-même ; le plafonnement
 * n'est donc pas un ajustement d'équilibrage mais un FILET : si quelqu'un retouche
 * A, B ou C, la règle tient quand même, et le pire qui arrive est une courbe de
 * prix qui s'aplatit — jamais une partie bloquée.
 */
export function storageCost(tier: number): number {
  const raw = STORAGE_COST.a * tier ** 2 + STORAGE_COST.b * tier + STORAGE_COST.c
  const ceiling = getNectarCapacity(tier - 1) - SOFTLOCK_MARGIN
  return Math.max(1, Math.min(raw, ceiling))
}

/** Les six voisines d'une alvéole, en axial. */
export const NEIGHBORS: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
] as const

// Les branches partent de quatre voisines de la ruche, puis s'incurvent : trois
// rayons droits auraient fait une étoile, pas un rayon de miel. Le coude ramène
// les alvéoles les unes contre les autres.
//
// DEUX MOITIÉS, DEUX MONNAIES.
//
// Le rayon du vol (réserve, butineuse, vol, pousse, première ouvrière) se paie
// en NECTAR — celui que le joueur rapporte lui-même : améliorer son vol se paie
// en volant. Il est PLAFONNÉ, donc borné : voir `getNectarCapacity`.
//
// Le rayon de la ruche (ventilation, économie, maturation, effectifs) se paie en
// MIEL, et il ne se dévoile qu'une fois la première ouvrière installée : il
// règle la transformation, et il n'y a rien à régler avant qu'elle tourne. C'est
// aussi le débouché qui manquait au miel — il se produisait sans jamais se
// dépenser.
//
// Ses prix sont VOLONTAIREMENT BAS au départ, et l'inverse exact du rayon du vol :
// le nectar se pilote, le miel se récompense. Le premier réglage (ventilation I,
// 1 miel) tombe après QUATRE lots — la première ouvrière se fait sentir presque
// tout de suite. Les rangs II et III des effectifs (ouvrières, butineuses) sont
// bas pour la même raison : ils ferment la boucle (plus de miel → plus
// d'ouvrières → plus de miel), et une boucle qui met trop longtemps à se fermer
// ne se lit pas comme une boucle. Le miel n'ayant pas de plafond, la courbe peut
// démarrer aussi bas qu'on veut sans jamais bloquer le joueur.
//
// Ces alvéoles-là sont serrées CONTRE la ruche, dans les creux laissés par les
// quatre premières branches : le rayon s'épaissit au centre au lieu de pousser
// quatre bras de plus, et l'écran reste lisible sans glissé.
// Toutes les alvéoles POSÉES À LA MAIN. La branche « réserve » n'en fait plus
// partie : elle est trop longue pour être écrite, elle est générée (cf. `COMB`).
const HAND_PLACED: readonly CombCell[] = [
  // Ouvrières — au bout de la branche « réserve », et nulle part ailleurs.
  //
  // 640, c'est plus que la réserve pleine du premier palier (400) : cette alvéole
  // demande DEUX paliers de réserve, et elle n'est de toute façon visible qu'une
  // fois le tracé du début bâti jusqu'à (2, -4). Le jeu bascule là : jusqu'ici le
  // nectar servait à s'améliorer, à partir d'ici il se transforme (cf. `HONEY`).
  //
  // Les suivantes se paient en miel et donnent une ouvrière de plus : un lot
  // rend `honeyPerWorker` PAR ouvrière, l'effectif multiplie donc directement la
  // production. C'est le seul investissement du jeu qui se rembourse.
  {
    id: 'workers-1',
    kind: 'workers',
    tier: 1,
    cost: 640,
    currency: 'nectar',
    q: 3,
    r: -5,
    bees: 1,
  },
  { id: 'workers-2', kind: 'workers', tier: 2, cost: 4, currency: 'honey', q: 2, r: -5, bees: 1 },
  { id: 'workers-3', kind: 'workers', tier: 3, cost: 9, currency: 'honey', q: 3, r: -6, bees: 1 },
  { id: 'workers-4', kind: 'workers', tier: 4, cost: 26, currency: 'honey', q: 2, r: -6, bees: 2 },

  // Butineuses — à droite de la ruche. La première se paie au nectar (c'est le
  // doublement le plus lisible du jeu) ; les deux suivantes au miel, et elles
  // ramènent le joueur au pré : plus de butineuses, plus de nectar, donc plus de
  // lots.
  {
    id: 'foragers-1',
    kind: 'foragers',
    tier: 1,
    cost: 120,
    currency: 'nectar',
    q: 1,
    r: 0,
    bees: 1,
  },
  {
    id: 'foragers-2',
    kind: 'foragers',
    tier: 2,
    cost: 5,
    currency: 'honey',
    q: 2,
    r: 0,
    bees: 1,
  },
  {
    id: 'foragers-3',
    kind: 'foragers',
    tier: 3,
    cost: 18,
    currency: 'honey',
    q: 2,
    r: -1,
    bees: 2,
  },

  // Vol — vers le bas.
  { id: 'flight-1', kind: 'flight', tier: 1, cost: 60, currency: 'nectar', q: 0, r: 1 },
  { id: 'flight-2', kind: 'flight', tier: 2, cost: 170, currency: 'nectar', q: -1, r: 2 },
  { id: 'flight-3', kind: 'flight', tier: 3, cost: 340, currency: 'nectar', q: -1, r: 3 },
  { id: 'flight-4', kind: 'flight', tier: 4, cost: 600, currency: 'nectar', q: -2, r: 4 },
  { id: 'flight-5', kind: 'flight', tier: 5, cost: 750, currency: 'nectar', q: -1, r: 4 },
  { id: 'flight-6', kind: 'flight', tier: 6, cost: 900, currency: 'nectar', q: -1, r: 5 },

  // Pousse — vers la gauche.
  { id: 'growth-1', kind: 'growth', tier: 1, cost: 60, currency: 'nectar', q: -1, r: 0 },
  { id: 'growth-2', kind: 'growth', tier: 2, cost: 170, currency: 'nectar', q: -2, r: 0 },
  { id: 'growth-3', kind: 'growth', tier: 3, cost: 340, currency: 'nectar', q: -2, r: -1 },
  { id: 'growth-4', kind: 'growth', tier: 4, cost: 600, currency: 'nectar', q: -3, r: -1 },
  { id: 'growth-5', kind: 'growth', tier: 5, cost: 750, currency: 'nectar', q: -3, r: 0 },
  { id: 'growth-6', kind: 'growth', tier: 6, cost: 900, currency: 'nectar', q: -4, r: 0 },

  // Ventilation — les ailes battent au-dessus des rayons : le lot mûrit plus
  // vite. En haut à droite de la ruche, dans le creux de la branche « réserve ».
  {
    id: 'fanning-1',
    kind: 'fanning',
    tier: 1,
    cost: 1,
    currency: 'honey',
    q: 1,
    r: -1,
  },
  { id: 'fanning-2', kind: 'fanning', tier: 2, cost: 5, currency: 'honey', q: 2, r: -2 },
  { id: 'fanning-3', kind: 'fanning', tier: 3, cost: 12, currency: 'honey', q: 2, r: -3 },
  { id: 'fanning-4', kind: 'fanning', tier: 4, cost: 30, currency: 'honey', q: 3, r: -3 },

  // Économie — un lot prend moins de nectar. En bas à gauche, contre la branche
  // « vol » : c'est la moitié du jeu qui rend du temps de vol au joueur.
  {
    id: 'thrift-1',
    kind: 'thrift',
    tier: 1,
    cost: 2,
    currency: 'honey',
    q: -1,
    r: 1,
  },
  { id: 'thrift-2', kind: 'thrift', tier: 2, cost: 6, currency: 'honey', q: -2, r: 2 },
  { id: 'thrift-3', kind: 'thrift', tier: 3, cost: 15, currency: 'honey', q: -2, r: 3 },
  { id: 'thrift-4', kind: 'thrift', tier: 4, cost: 34, currency: 'honey', q: -3, r: 4 },

  // Maturation — le même lot rend plus de miel. Au-dessus à gauche, dans le
  // dernier creux du centre.
  {
    id: 'ripening-1',
    kind: 'ripening',
    tier: 1,
    cost: 3,
    currency: 'honey',
    q: -1,
    r: -1,
  },
  { id: 'ripening-2', kind: 'ripening', tier: 2, cost: 8, currency: 'honey', q: 0, r: -2 },
  { id: 'ripening-3', kind: 'ripening', tier: 3, cost: 18, currency: 'honey', q: 0, r: -3 },
  { id: 'ripening-4', kind: 'ripening', tier: 4, cost: 42, currency: 'honey', q: -1, r: -3 },
] as const

// LA BRANCHE « RÉSERVE », GÉNÉRÉE.
//
// Quinze alvéoles pourraient encore s'écrire à la main, mais leur PRIX non : il
// sort d'une formule, et la géométrie suit la même règle pour que retoucher
// `STORAGE_TIERS` ne demande jamais de replacer des coordonnées. La règle est en
// deux temps :
//
//   1. les SIX PREMIÈRES gardent exactement le tracé qu'elles avaient — le coude
//      qui remonte à droite puis revient sur lui-même, et surtout l'alvéole
//      (2, -4) contre laquelle pousse la première ouvrière. Ce tracé porte
//      l'ordre de dévoilement du début de partie, on n'y touche pas ;
//   2. au-delà, la branche cesse d'être un fil et devient un PAVAGE : elle
//      remplit le haut du rayon en serpentin, ligne par ligne, de la droite vers
//      la gauche puis l'inverse. Un fil de quinze alvéoles aurait tiré une antenne
//      de 500 px hors de la fenêtre ; le serpentin fait ce que fait un vrai
//      rayon — il s'étend en nappe.
//
// Le serpentin passe d'une ligne à l'autre par la voisine `(0, -1)`, donc chaque
// alvéole touche la précédente : le dévoilement reste ce qu'il est (§7.2 du GDD),
// une cire qui avance de proche en proche.
const STORAGE_SEED: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, -2],
  [1, -3],
  [2, -4],
  [1, -4],
  [1, -5],
] as const

/** Bornes du serpentin, en q. Cinq colonnes : le pavage tient dans la fenêtre. */
const STORAGE_ROWS = { qMax: 1, qMin: -3, firstR: -6 } as const

function storageCells(): CombCell[] {
  const taken = new Set(HAND_PLACED.map((c) => `${c.q},${c.r}`))
  const cells: CombCell[] = []
  const push = (q: number, r: number): void => {
    if (taken.has(`${q},${r}`)) {
      // Impossible avec la géométrie actuelle, et c'est le genre de faute qu'on
      // veut voir tout de suite : deux alvéoles au même endroit, c'est une case
      // qui en cache une autre pour toujours.
      throw new Error(`comb: l'alvéole réserve (${q}, ${r}) est déjà occupée`)
    }
    taken.add(`${q},${r}`)
    const tier = cells.length + 1
    cells.push({
      id: `storage-${tier}`,
      kind: 'storage',
      tier,
      cost: storageCost(tier),
      currency: 'nectar',
      q,
      r,
    })
  }

  for (const [q, r] of STORAGE_SEED) {
    if (cells.length >= STORAGE_TIERS) return cells
    push(q, r)
  }

  // Le serpentin reprend où le tracé s'arrête : la ligne du dessus, au même q.
  let r = STORAGE_ROWS.firstR
  let step = -1
  let q = STORAGE_SEED[STORAGE_SEED.length - 1][0]
  while (cells.length < STORAGE_TIERS) {
    push(q, r)
    const next = q + step
    if (next > STORAGE_ROWS.qMax || next < STORAGE_ROWS.qMin) {
      // Bout de ligne : on monte d'un cran et on repart dans l'autre sens.
      r -= 1
      step = -step
    } else {
      q = next
    }
  }
  return cells
}

export const COMB: readonly CombCell[] = [...storageCells(), ...HAND_PLACED]

/** Nombre d'alvéoles achetables au total (jauge du bouton d'accès). */
export const COMB_TOTAL = COMB.length

/**
 * Les alvéoles par coordonnée. Le dévoilement interroge les six voisines de
 * chaque alvéole à chaque frame : la recherche linéaire refaisait un balayage de
 * tout le rayon six fois par alvéole, pour un résultat qui ne change qu'à l'achat.
 */
const CELL_AT = new Map<string, CombCell>(COMB.map((c) => [`${c.q},${c.r}`, c]))

/** L'alvéole posée en (q, r), s'il y en a une. */
export function cellAt(q: number, r: number): CombCell | undefined {
  return CELL_AT.get(`${q},${r}`)
}

/**
 * Effet d'UN niveau de chaque branche.
 *
 * La réserve n'y figure plus : son effet n'est pas un pas mais une COURBE
 * (`getNectarCapacity`), et c'est cette courbe qui décide si le rayon est
 * finissable. Tout s'y paie en nectar, or le nectar est PLAFONNÉ — une alvéole
 * plus chère que la réserve du moment est hors d'atteinte, le joueur butine et la
 * réserve sature avant le prix. Le plafond monte donc
 * 100 / 400 / 1100 / 2200 / 3700 / 5600…, et :
 *
 *   - la branche « réserve » reste toujours payable, par construction (règle d'or,
 *     cf. `storageCost`) — c'est elle qui déverrouille tout le reste ;
 *   - les alvéoles de rang III (340) demandent un palier de réserve, celles de
 *     rang IV (600) et l'alvéole « ouvrières » (640) deux. Ce n'est pas un
 *     cul-de-sac, c'est un ORDRE : on agrandit sa ruche avant de s'offrir le luxe.
 *     La courbe raide franchit ces seuils plus vite que l'ancien pas fixe, et c'est
 *     assumé : ce qui borne la fin de partie n'est plus le plafond de la réserve
 *     mais le PRIX du palier suivant, qui prend les trois quarts de ce plafond.
 *
 * Toute nouvelle alvéole EN NECTAR doit tenir sous `getNectarCapacity(n)` pour le
 * niveau de réserve `n` auquel elle se dévoile, sinon elle est inachetable pour
 * toujours. Le miel, lui, n'a pas de plafond : les alvéoles de la ruche ne
 * connaissent pas cette contrainte.
 */
export const UPGRADE_EFFECT = {
  /**
   * Gain de vitesse de vol par niveau. TRÈS léger, et c'est voulu : le pilotage
   * est ce que le joueur maîtrise, une amélioration qui le rendrait facile
   * viderait l'enregistrement de son intérêt.
   */
  flightStep: 0.04,
  /** Accélération du calendrier des fleurs par niveau. */
  growthStep: 0.08,
  /**
   * Accélération du lot par niveau (`batchMs` divisé par 1 + n × ce pas). Quatre
   * niveaux ramènent le lot de 8 s à 5 s : franc, mais le lot reste une attente.
   */
  fanningStep: 0.15,
  /**
   * Réduction du nectar par lot, par niveau. Quatre niveaux font tomber le lot de
   * 100 à 68 nectar — de quoi rendre du souffle à une réserve que la
   * transformation asséchait, sans jamais la rendre gratuite (le plafond haut est
   * volontairement loin de 0,25 : un lot doit toujours se voir dans la réserve).
   */
  thriftStep: 0.08,
  /**
   * Miel rendu par lot, par niveau. Quatre niveaux DOUBLENT le rendement : c'est
   * la branche la plus chère, et c'est normal — elle multiplie tout le reste.
   */
  ripeningStep: 0.25,
} as const

// Les rangs se lisent en chiffres romains, et la branche « réserve » va jusqu'à
// XV : une table écrite à la main s'arrêtait à VI et rendait `undefined` au-delà.
// La table de chiffres va bien plus loin que quinze, pour que rallonger la branche
// reste une seule ligne à changer.
const ROMAN_DIGITS: readonly (readonly [number, string])[] = [
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
] as const

/** « XXVII » pour 27. Rien pour 0 ou moins : il n'y a pas de rang zéro. */
export function roman(n: number): string {
  let rest = Math.floor(n)
  let out = ''
  for (const [value, digit] of ROMAN_DIGITS) {
    while (rest >= value) {
      out += digit
      rest -= value
    }
  }
  return out
}

/** Nombre d'alvéoles par branche, compté une fois pour toutes (cf. `tierLabel`). */
const BRANCH_SIZE = new Map<UpgradeKind, number>()
for (const cell of COMB) BRANCH_SIZE.set(cell.kind, (BRANCH_SIZE.get(cell.kind) ?? 0) + 1)

/** « II » pour la deuxième alvéole d'une branche ; rien si la branche est unique. */
export function tierLabel(cell: CombCell): string {
  return (BRANCH_SIZE.get(cell.kind) ?? 0) > 1 ? roman(cell.tier) : ''
}
