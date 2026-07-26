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
  /**
   * Alvéole d'une AUTRE branche à posséder pour que celle-ci se dévoile.
   *
   * Le voisinage seul ne suffit pas toujours : une alvéole qui se paie en miel et
   * qui touche la ruche serait visible dès la première seconde, prix en miel
   * affiché, alors que le miel n'existe pas encore. Le prérequis dit l'ordre que
   * la géométrie ne peut pas dire.
   */
  needs?: string
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
// en volant. Il est PLAFONNÉ, donc borné : voir `UPGRADE_EFFECT.storageStep`.
//
// Le rayon de la ruche (ventilation, économie, maturation, effectifs) se paie en
// MIEL, et il ne se dévoile qu'une fois la première ouvrière installée : il
// règle la transformation, et il n'y a rien à régler avant qu'elle tourne. C'est
// aussi le débouché qui manquait au miel — il se produisait sans jamais se
// dépenser.
//
// Ces alvéoles-là sont serrées CONTRE la ruche, dans les creux laissés par les
// quatre premières branches : le rayon s'épaissit au centre au lieu de pousser
// quatre bras de plus, et l'écran reste lisible sans glissé.
export const COMB: readonly CombCell[] = [
  // Réserve — vers le haut. Les deux derniers paliers relèvent le plafond, donc
  // ce que les rangs V et VI des autres branches peuvent coûter.
  { id: 'storage-1', kind: 'storage', tier: 1, cost: 30, currency: 'nectar', q: 0, r: -1 },
  { id: 'storage-2', kind: 'storage', tier: 2, cost: 90, currency: 'nectar', q: 1, r: -2 },
  { id: 'storage-3', kind: 'storage', tier: 3, cost: 200, currency: 'nectar', q: 1, r: -3 },
  { id: 'storage-4', kind: 'storage', tier: 4, cost: 330, currency: 'nectar', q: 2, r: -4 },
  { id: 'storage-5', kind: 'storage', tier: 5, cost: 440, currency: 'nectar', q: 1, r: -4 },
  { id: 'storage-6', kind: 'storage', tier: 6, cost: 540, currency: 'nectar', q: 1, r: -5 },

  // Ouvrières — au bout de la branche « réserve », et nulle part ailleurs.
  //
  // 430, c'est la réserve pleine des quatre premiers paliers (450) à vingt
  // nectar près : cette alvéole est LA dernière chose que le nectar seul peut
  // payer, et elle n'est même visible qu'une fois ces quatre paliers bâtis. Le
  // jeu bascule là : jusqu'ici le nectar servait à s'améliorer, à partir d'ici
  // il se transforme (cf. `HONEY`).
  //
  // Les suivantes se paient en miel et donnent une ouvrière de plus : un lot
  // rend `honeyPerWorker` PAR ouvrière, l'effectif multiplie donc directement la
  // production. C'est le seul investissement du jeu qui se rembourse.
  {
    id: 'workers-1',
    kind: 'workers',
    tier: 1,
    cost: 430,
    currency: 'nectar',
    q: 3,
    r: -5,
    bees: 1,
    // La réserve à quatre paliers, dite NOIR SUR BLANC plutôt que laissée à la
    // géométrie. L'alvéole touche `storage-4` et le voisinage suffirait —
    // jusqu'au jour où on pousse une alvéole d'un cran : le basculement du jeu
    // ne doit pas dépendre d'un coude du rayon.
    needs: 'storage-4',
  },
  { id: 'workers-2', kind: 'workers', tier: 2, cost: 6, currency: 'honey', q: 2, r: -5, bees: 1 },
  { id: 'workers-3', kind: 'workers', tier: 3, cost: 15, currency: 'honey', q: 3, r: -6, bees: 1 },
  { id: 'workers-4', kind: 'workers', tier: 4, cost: 35, currency: 'honey', q: 2, r: -6, bees: 2 },

  // Butineuses — à droite de la ruche. La première se paie au nectar (c'est le
  // doublement le plus lisible du jeu) ; les deux suivantes au miel, et elles
  // ramènent le joueur au pré : plus de butineuses, plus de nectar, donc plus de
  // lots.
  {
    id: 'foragers-1',
    kind: 'foragers',
    tier: 1,
    cost: 80,
    currency: 'nectar',
    q: 1,
    r: 0,
    bees: 1,
  },
  {
    id: 'foragers-2',
    kind: 'foragers',
    tier: 2,
    cost: 8,
    currency: 'honey',
    q: 2,
    r: 0,
    bees: 1,
    needs: 'workers-1',
  },
  {
    id: 'foragers-3',
    kind: 'foragers',
    tier: 3,
    cost: 30,
    currency: 'honey',
    q: 2,
    r: -1,
    bees: 2,
    // Elle touche `foragers-1`, donc le voisinage de branche la montrerait dès
    // la première butineuse — prix en miel affiché avant que le miel existe.
    needs: 'workers-1',
  },

  // Vol — vers le bas.
  { id: 'flight-1', kind: 'flight', tier: 1, cost: 40, currency: 'nectar', q: 0, r: 1 },
  { id: 'flight-2', kind: 'flight', tier: 2, cost: 110, currency: 'nectar', q: -1, r: 2 },
  { id: 'flight-3', kind: 'flight', tier: 3, cost: 240, currency: 'nectar', q: -1, r: 3 },
  { id: 'flight-4', kind: 'flight', tier: 4, cost: 400, currency: 'nectar', q: -2, r: 4 },
  { id: 'flight-5', kind: 'flight', tier: 5, cost: 500, currency: 'nectar', q: -1, r: 4 },
  { id: 'flight-6', kind: 'flight', tier: 6, cost: 620, currency: 'nectar', q: -1, r: 5 },

  // Pousse — vers la gauche.
  { id: 'growth-1', kind: 'growth', tier: 1, cost: 40, currency: 'nectar', q: -1, r: 0 },
  { id: 'growth-2', kind: 'growth', tier: 2, cost: 110, currency: 'nectar', q: -2, r: 0 },
  { id: 'growth-3', kind: 'growth', tier: 3, cost: 240, currency: 'nectar', q: -2, r: -1 },
  { id: 'growth-4', kind: 'growth', tier: 4, cost: 400, currency: 'nectar', q: -3, r: -1 },
  { id: 'growth-5', kind: 'growth', tier: 5, cost: 500, currency: 'nectar', q: -3, r: 0 },
  { id: 'growth-6', kind: 'growth', tier: 6, cost: 620, currency: 'nectar', q: -4, r: 0 },

  // Ventilation — les ailes battent au-dessus des rayons : le lot mûrit plus
  // vite. En haut à droite de la ruche, dans le creux de la branche « réserve ».
  {
    id: 'fanning-1',
    kind: 'fanning',
    tier: 1,
    cost: 3,
    currency: 'honey',
    q: 1,
    r: -1,
    needs: 'workers-1',
  },
  { id: 'fanning-2', kind: 'fanning', tier: 2, cost: 8, currency: 'honey', q: 2, r: -2 },
  { id: 'fanning-3', kind: 'fanning', tier: 3, cost: 18, currency: 'honey', q: 2, r: -3 },
  { id: 'fanning-4', kind: 'fanning', tier: 4, cost: 40, currency: 'honey', q: 3, r: -3 },

  // Économie — un lot prend moins de nectar. En bas à gauche, contre la branche
  // « vol » : c'est la moitié du jeu qui rend du temps de vol au joueur.
  {
    id: 'thrift-1',
    kind: 'thrift',
    tier: 1,
    cost: 4,
    currency: 'honey',
    q: -1,
    r: 1,
    needs: 'workers-1',
  },
  { id: 'thrift-2', kind: 'thrift', tier: 2, cost: 10, currency: 'honey', q: -2, r: 2 },
  { id: 'thrift-3', kind: 'thrift', tier: 3, cost: 22, currency: 'honey', q: -2, r: 3 },
  { id: 'thrift-4', kind: 'thrift', tier: 4, cost: 45, currency: 'honey', q: -3, r: 4 },

  // Maturation — le même lot rend plus de miel. Au-dessus à gauche, dans le
  // dernier creux du centre.
  {
    id: 'ripening-1',
    kind: 'ripening',
    tier: 1,
    cost: 5,
    currency: 'honey',
    q: -1,
    r: -1,
    needs: 'workers-1',
  },
  { id: 'ripening-2', kind: 'ripening', tier: 2, cost: 12, currency: 'honey', q: 0, r: -2 },
  { id: 'ripening-3', kind: 'ripening', tier: 3, cost: 26, currency: 'honey', q: 0, r: -3 },
  { id: 'ripening-4', kind: 'ripening', tier: 4, cost: 55, currency: 'honey', q: -1, r: -3 },
] as const

/** Nombre d'alvéoles achetables au total (jauge du bouton d'accès). */
export const COMB_TOTAL = COMB.length

/**
 * Effet d'UN niveau de chaque branche.
 *
 * `storageStep` n'est pas un chiffre libre : c'est LUI qui décide si le rayon
 * est finissable. Tout s'y paie en nectar, or le nectar est PLAFONNÉ — une
 * alvéole plus chère que la réserve du moment est hors d'atteinte, le joueur
 * butine et la réserve sature avant le prix. Avec 100 par palier et quatre
 * alvéoles de réserve, le plafond monte 50 / 150 / 250 / 350 / 450 :
 *
 *   - la branche « réserve » reste toujours payable (30, puis 90 sous 150,
 *     200 sous 250, 330 sous 350) — c'est elle qui déverrouille tout le reste ;
 *   - les alvéoles de rang III (240) demandent deux paliers de réserve, celles
 *     de rang IV (400) les quatre. Ce n'est pas un cul-de-sac, c'est un ORDRE :
 *     on agrandit sa ruche avant de s'offrir le luxe.
 *
 * Toute nouvelle alvéole EN NECTAR doit tenir sous le plafond que la branche
 * « réserve » atteint à ce moment-là, sinon elle est inachetable pour toujours.
 * C'est ce qui cale l'alvéole « ouvrières » à 430 (le maximum sous 450, la
 * réserve à quatre paliers), puis les rangs V à 500 (sous 550, cinq paliers) et
 * les rangs VI à 620 (sous 650, six paliers). Le miel, lui, n'a pas de plafond :
 * les alvéoles de la ruche ne connaissent pas cette contrainte.
 */
export const UPGRADE_EFFECT = {
  storageStep: 100,
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

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'] as const

/** « II » pour la deuxième alvéole d'une branche ; rien si la branche est unique. */
export function tierLabel(cell: CombCell): string {
  const branch = COMB.filter((c) => c.kind === cell.kind)
  return branch.length > 1 ? ROMAN[cell.tier] : ''
}

/** L'alvéole qui précède celle-ci dans sa branche (rien pour un rang 1). */
export function previousTier(cell: CombCell): CombCell | undefined {
  return COMB.find((c) => c.kind === cell.kind && c.tier === cell.tier - 1)
}
