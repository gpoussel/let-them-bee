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
//
// LE RAYON FAIT 166 ALVÉOLES, et il n'est pas ÉCRIT : il est ENGENDRÉ. Trois
// populations s'y côtoient, et la façon dont chacune existe dit son rôle :
//
//   - le DÉBUT DE PARTIE (réserve, butineuses, vol, pousse, ouvrières,
//     ventilation, économie, maturation) reste posé à la main : c'est la
//     quarantaine d'alvéoles dont l'ordre de dévoilement porte l'apprentissage
//     du jeu, et un ordre appris ne se recalcule pas ;
//   - le GRIND (110 alvéoles, neuf branches d'au plus QUINZE crans) sort de
//     boucles : un « Aérodynamisme XIII » écrit à la main serait une ligne de
//     copie, pas une décision. Ce qui se décide, c'est la COURBE — elle tient en
//     trois nombres ;
//   - les JALONS et les PIÈGES (dix alvéoles) ont leur EFFET et leur PRIX écrits
//     à la main, un par un, parce que chacun retourne une règle du jeu ou tend un
//     traquenard — mais leur PLACE, elle, est calculée comme le reste : ils se
//     posent au bout de la branche qu'ils couronnent.
//
// La GÉOMÉTRIE est donc unique et centrale (cf. `allocate`) : aucune coordonnée
// n'est écrite deux fois, et deux alvéoles ne peuvent pas se superposer — la
// table d'occupation est la même pour tout le monde, et elle jette si on essaie.

import { getNectarCapacity, type BeeKindId } from './balance'

/**
 * Les branches du rayon. Une branche = un effet, plusieurs alvéoles.
 *
 * Les huit premières sont celles du début de partie (posées à la main) ; les
 * neuf suivantes sont les longues branches engendrées ; les dernières sont les
 * alvéoles uniques — jalons et pièges — qui n'ont qu'un rang.
 */
export type UpgradeKind =
  // Le début de partie, posé à la main.
  | 'storage'
  | 'foragers'
  | 'flight'
  | 'growth'
  | 'workers'
  | 'fanning'
  | 'thrift'
  | 'ripening'
  // Le grind, engendré (cf. `GRIND`).
  | 'microNaps'
  | 'slowRipening'
  | 'aerodynamics'
  | 'deepRoots'
  | 'frenzy'
  | 'synergy'
  | 'queenMother'
  | 'workerQueen'
  | 'patrols'
  // Les jalons : ils changent une règle (cf. `MILESTONES`).
  | 'honorGuard'
  | 'frenzyDance'
  | 'mutantCorollas'
  | 'royalDigestion'
  | 'zeroInertia'
  | 'goldenSwarm'
  | 'floralClock'
  // Les pièges et cosmétiques (cf. `TRAPS`).
  | 'heavyPollen'
  | 'shinyWax'
  | 'dullBuzz'

/** Monnaie d'une alvéole. Le rayon en accepte deux, et le dit par ses icônes. */
export type Currency = 'nectar' | 'honey'

/**
 * PRIX D'UNE ALVÉOLE. Les deux monnaies sont facultatives et CUMULATIVES : une
 * alvéole qui porte les deux se paie dans les deux à la fois, pas au choix.
 *
 * C'est ce qui manquait au rayon pour que ses deux moitiés se parlent. Le nectar
 * se pilote et il est PLAFONNÉ ; le miel s'accumule et ne l'est pas. Un prix
 * mixte demande donc les deux vertus en même temps — avoir volé assez bien pour
 * remplir une réserve, et avoir laissé la ruche tourner assez longtemps pour la
 * transformer. Aucune des deux ne s'y substitue à l'autre.
 */
export interface Cost {
  honey?: number
  nectar?: number
}

export interface CombCell {
  /** Identifiant stable, persisté en sauvegarde (`storage-2`, `flight-1`…). */
  id: string
  kind: UpgradeKind
  /** Rang dans sa branche, à partir de 1. Sert au libellé (I, II, III, IV). */
  tier: number
  /** Prix, dans une monnaie ou dans les deux. Une alvéole s'achète une fois, et pour de bon. */
  cost: Cost
  q: number
  r: number
  /**
   * Abeilles DONNÉES par l'alvéole. Ces branches-là n'améliorent rien : elles
   * ajoutent un effectif, et la quantité se lit ici plutôt que dans une table à
   * part. La CASTE, elle, se déduit de la branche (cf. `CELL_BEE_KIND`).
   */
  bees?: number
}

/**
 * Nombre d'alvéoles de la branche « réserve ». C'est la plus longue du début de
 * partie, mais elle reste COURTE : quinze paliers (« Storage I » à
 * « Storage XV »). Une branche de cinquante alvéoles se lisait comme une corvée —
 * cinquante clics dont chacun ne pesait presque rien. Quinze paliers sur une
 * courbe raide font le contraire : peu de décisions, chacune coûteuse (voir
 * `getNectarCapacity` et `storageCost`).
 *
 * Le grind ne va pas plus loin : quinze crans au plus, lui aussi (cf.
 * `GRIND_TIERS`). Ses alvéoles ne déverrouillent rien, elles font monter un
 * chiffre — mais quinze reste le rang le plus haut que le rayon sache écrire en
 * chiffres romains sans qu'on ait à le déchiffrer.
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
 * Écart minimal, en nectar, entre le prix d'une alvéole et le plafond qui doit la
 * payer. Un prix ÉGAL au plafond serait payable en théorie (`nectar >= cost` à
 * réserve pleine) mais illisible en pratique : le joueur regarderait sa jauge
 * saturée en se demandant s'il lui manque quelque chose.
 */
const SOFTLOCK_MARGIN = 10

/**
 * LE PLAFOND ULTIME, en nectar : ce que contient la réserve une fois la branche
 * « réserve » bâtie jusqu'au bout, moins la marge de lisibilité.
 *
 * Aucun prix en nectar du rayon entier ne peut le dépasser — c'est la borne que
 * vérifie `assertPayable`, et elle est vérifiée à l'IMPORT du module : un rayon
 * bloqué ne se découvre pas au bout de six heures de partie, il ne démarre pas.
 */
export const NECTAR_CEILING = getNectarCapacity(STORAGE_TIERS) - SOFTLOCK_MARGIN

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

/**
 * VÉRIFICATION PROGRAMMATIQUE DU NECTAR. Jette si une alvéole demande plus de
 * nectar que la ruche ne pourra JAMAIS en tenir.
 *
 * C'est la seule faute du rayon qui soit irréparable en jeu : le miel s'accumule
 * sans borne, donc un prix en miel n'est jamais qu'une longue attente ; le nectar
 * sature. Une alvéole à 50 000 nectar n'est pas « chère », elle est morte, et
 * elle tue avec elle tout ce qui pousse derrière.
 *
 * La borne retenue est le plafond ULTIME et non le plafond du moment : le
 * dévoilement du rayon ne suit aucun ordre écrit (il suit la forme, cf.
 * `GameState.isRevealed`), on ne peut donc pas savoir avec quel niveau de réserve
 * le joueur arrivera devant une alvéole donnée. La règle est donc la plus large
 * qui reste vraie — et elle suffit, parce que la branche « réserve » est payable
 * de bout en bout par construction : le joueur PEUT toujours atteindre ce plafond.
 */
function assertPayable(cell: CombCell): CombCell {
  const nectar = cell.cost.nectar
  if (nectar !== undefined && nectar > NECTAR_CEILING) {
    throw new Error(
      `comb: l'alvéole ${cell.id} coûte ${String(nectar)} nectar, ` +
        `au-delà du plafond ultime de ${String(NECTAR_CEILING)} — elle serait inachetable pour toujours`,
    )
  }
  if (nectar !== undefined && nectar <= 0) {
    throw new Error(`comb: l'alvéole ${cell.id} a un prix en nectar non positif`)
  }
  const honey = cell.cost.honey
  if (honey !== undefined && honey <= 0) {
    throw new Error(`comb: l'alvéole ${cell.id} a un prix en miel non positif`)
  }
  if (nectar === undefined && honey === undefined) {
    throw new Error(`comb: l'alvéole ${cell.id} est gratuite — le rayon ne fait pas de cadeaux`)
  }
  return cell
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

/** Caste versée par les branches qui donnent des abeilles (cf. `CombCell.bees`). */
export const CELL_BEE_KIND: Partial<Record<UpgradeKind, BeeKindId>> = {
  foragers: 'forager',
  workers: 'worker',
  workerQueen: 'worker',
  patrols: 'warrior',
  honorGuard: 'warrior',
}

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
  // fois `storage-3` bâtie — elle est posée en (2, -4), contre elle. Le jeu
  // bascule là : jusqu'ici le nectar servait à s'améliorer, à partir d'ici il se
  // transforme (cf. `HONEY`). Elle se dévoile donc AVANT `storage-4`, qui lui
  // succède sur la branche : la transformation est le tournant du jeu, elle ne
  // s'annonce pas au bout du plus long prix en nectar du début. Le plafond après
  // `storage-3` vaut 2200, les 640 sont tenables sans autre achat.
  //
  // Les suivantes se paient en miel et donnent une ouvrière de plus : un lot
  // rend `honeyPerWorker` PAR ouvrière, l'effectif multiplie donc directement la
  // production. C'est le seul investissement du jeu qui se rembourse.
  { id: 'workers-1', kind: 'workers', tier: 1, cost: { nectar: 640 }, q: 2, r: -4, bees: 1 },
  { id: 'workers-2', kind: 'workers', tier: 2, cost: { honey: 4 }, q: 2, r: -5, bees: 1 },
  { id: 'workers-3', kind: 'workers', tier: 3, cost: { honey: 9 }, q: 3, r: -6, bees: 1 },
  { id: 'workers-4', kind: 'workers', tier: 4, cost: { honey: 26 }, q: 2, r: -6, bees: 2 },

  // Butineuses — à droite de la ruche. La première se paie au nectar (c'est le
  // doublement le plus lisible du jeu) ; les deux suivantes au miel, et elles
  // ramènent le joueur au pré : plus de butineuses, plus de nectar, donc plus de
  // lots.
  { id: 'foragers-1', kind: 'foragers', tier: 1, cost: { nectar: 120 }, q: 1, r: 0, bees: 1 },
  { id: 'foragers-2', kind: 'foragers', tier: 2, cost: { honey: 5 }, q: 2, r: 0, bees: 1 },
  { id: 'foragers-3', kind: 'foragers', tier: 3, cost: { honey: 18 }, q: 2, r: -1, bees: 2 },

  // Vol — vers le bas.
  { id: 'flight-1', kind: 'flight', tier: 1, cost: { nectar: 60 }, q: 0, r: 1 },
  { id: 'flight-2', kind: 'flight', tier: 2, cost: { nectar: 170 }, q: -1, r: 2 },
  { id: 'flight-3', kind: 'flight', tier: 3, cost: { nectar: 340 }, q: -1, r: 3 },
  { id: 'flight-4', kind: 'flight', tier: 4, cost: { nectar: 600 }, q: -2, r: 4 },
  { id: 'flight-5', kind: 'flight', tier: 5, cost: { nectar: 750 }, q: -1, r: 4 },
  { id: 'flight-6', kind: 'flight', tier: 6, cost: { nectar: 900 }, q: -1, r: 5 },

  // Pousse — vers la gauche.
  { id: 'growth-1', kind: 'growth', tier: 1, cost: { nectar: 60 }, q: -1, r: 0 },
  { id: 'growth-2', kind: 'growth', tier: 2, cost: { nectar: 170 }, q: -2, r: 0 },
  { id: 'growth-3', kind: 'growth', tier: 3, cost: { nectar: 340 }, q: -2, r: -1 },
  { id: 'growth-4', kind: 'growth', tier: 4, cost: { nectar: 600 }, q: -3, r: -1 },
  { id: 'growth-5', kind: 'growth', tier: 5, cost: { nectar: 750 }, q: -3, r: 0 },
  { id: 'growth-6', kind: 'growth', tier: 6, cost: { nectar: 900 }, q: -4, r: 0 },

  // Ventilation — les ailes battent au-dessus des rayons : le lot mûrit plus
  // vite. En haut à droite de la ruche, dans le creux de la branche « réserve ».
  { id: 'fanning-1', kind: 'fanning', tier: 1, cost: { honey: 1 }, q: 1, r: -1 },
  { id: 'fanning-2', kind: 'fanning', tier: 2, cost: { honey: 5 }, q: 2, r: -2 },
  { id: 'fanning-3', kind: 'fanning', tier: 3, cost: { honey: 12 }, q: 2, r: -3 },
  { id: 'fanning-4', kind: 'fanning', tier: 4, cost: { honey: 30 }, q: 3, r: -3 },

  // Économie — un lot prend moins de nectar. En bas à gauche, contre la branche
  // « vol » : c'est la moitié du jeu qui rend du temps de vol au joueur.
  { id: 'thrift-1', kind: 'thrift', tier: 1, cost: { honey: 2 }, q: -1, r: 1 },
  { id: 'thrift-2', kind: 'thrift', tier: 2, cost: { honey: 6 }, q: -2, r: 2 },
  { id: 'thrift-3', kind: 'thrift', tier: 3, cost: { honey: 15 }, q: -2, r: 3 },
  { id: 'thrift-4', kind: 'thrift', tier: 4, cost: { honey: 34 }, q: -3, r: 4 },

  // Maturation — le même lot rend plus de miel. Au-dessus à gauche, dans le
  // dernier creux du centre.
  { id: 'ripening-1', kind: 'ripening', tier: 1, cost: { honey: 3 }, q: -1, r: -1 },
  { id: 'ripening-2', kind: 'ripening', tier: 2, cost: { honey: 8 }, q: 0, r: -2 },
  { id: 'ripening-3', kind: 'ripening', tier: 3, cost: { honey: 18 }, q: 0, r: -3 },
  { id: 'ripening-4', kind: 'ripening', tier: 4, cost: { honey: 42 }, q: -1, r: -3 },
] as const

// LA BRANCHE « RÉSERVE », GÉNÉRÉE.
//
// Quinze alvéoles pourraient encore s'écrire à la main, mais leur PRIX non : il
// sort d'une formule, et la géométrie suit la même règle pour que retoucher
// `STORAGE_TIERS` ne demande jamais de replacer des coordonnées. La règle est en
// deux temps :
//
//   1. les SIX PREMIÈRES portent l'ordre de dévoilement du début de partie : le
//      coude qui remonte à droite puis revient sur lui-même. Le quatrième pas se
//      détache du fil et va se poser en (3, -5), au-delà des ouvrières : c'est
//      (2, -4) qui revient à `workers-1`, contre `storage-3`, pour que la
//      transformation se montre au troisième palier de réserve et non au
//      quatrième. `storage-4` se dévoile alors par l'ouvrière, et `storage-5`
//      reste voisine de `storage-3` — le fil n'est pas coupé, il enjambe ;
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
  [3, -5],
  [1, -4],
  [1, -5],
] as const

/** Bornes du serpentin, en q. Cinq colonnes : le pavage tient dans la fenêtre. */
const STORAGE_ROWS = { qMax: 1, qMin: -3, firstR: -6 } as const

function storageCells(): CombCell[] {
  const taken = new Set(HAND_PLACED.map((c) => `${String(c.q)},${String(c.r)}`))
  const cells: CombCell[] = []
  const push = (q: number, r: number): void => {
    if (taken.has(`${String(q)},${String(r)}`)) {
      // Impossible avec la géométrie actuelle, et c'est le genre de faute qu'on
      // veut voir tout de suite : deux alvéoles au même endroit, c'est une case
      // qui en cache une autre pour toujours.
      throw new Error(`comb: l'alvéole réserve (${String(q)}, ${String(r)}) est déjà occupée`)
    }
    taken.add(`${String(q)},${String(r)}`)
    const tier = cells.length + 1
    cells.push(
      assertPayable({
        id: `storage-${String(tier)}`,
        kind: 'storage',
        tier,
        cost: { nectar: storageCost(tier) },
        q,
        r,
      }),
    )
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

// --- GÉOMÉTRIE INFINIE ------------------------------------------------------
//
// Le début de partie tient dans un dessin ; deux cents alvéoles de plus, non. Il
// faut donc une règle de placement qui ne connaisse aucune coordonnée et qui
// tienne quel que soit le nombre d'alvéoles demandé.
//
// Elle tient en une phrase : UNE BRANCHE POUSSE PAR SON BORD, VERS LE DEHORS,
// DANS SA DIRECTION.
//
// À chaque pas, on regarde toutes les cases LIBRES qui touchent la branche
// (elles ne peuvent donc pas se superposer à quoi que ce soit, la table
// d'occupation est commune à tout le rayon), et on prend celle qui minimise
//
//     distance à la ruche  +  ANG_WEIGHT × écart d'angle avec le cap de la branche
//
// Le premier terme pousse vers l'extérieur : une branche ne revient jamais se
// blottir contre le centre. Le second lui tient son cap : les neuf branches
// partent en éventail au lieu de se disputer le même quadrant. Comme le second
// terme est un COÛT et non une interdiction, une branche coincée contourne
// l'obstacle au lieu de mourir — c'est ce qui fait la spirale : arrivée au
// contact de sa voisine, elle glisse le long d'elle plutôt que de s'arrêter.
//
// Les branches poussent À TOUR DE RÔLE, une alvéole chacune par tour. Les faire
// pousser l'une après l'autre aurait donné à la première tout l'espace et à la
// dernière ce qui reste ; en alternance, elles se repoussent mutuellement et le
// rayon garde sa forme de rayon.
//
// Le plan hexagonal étant infini, l'algorithme ne peut pas échouer : le bord
// d'une région finie a toujours une case libre au-delà.

type Coord = readonly [number, number]

/** Pas d'un hexagone pointe en haut, en unités de rayon (cf. l'en-tête). */
const STEP_X = Math.sqrt(3)
const STEP_Y = 1.5

/**
 * Poids de l'écart de cap, en unités de rayon par radian. Vaut environ un pas et
 * demi d'alvéole pour un quart de tour : assez pour qu'une branche préfère son
 * cap, pas assez pour qu'elle s'entête contre un mur.
 */
const ANG_WEIGHT = 2.5

function key(q: number, r: number): string {
  return `${String(q)},${String(r)}`
}

/** Position d'une alvéole en unités de rayon, la ruche à l'origine. */
function center(q: number, r: number): { x: number; y: number } {
  return { x: STEP_X * (q + r / 2), y: STEP_Y * r }
}

/** Écart absolu entre deux caps, ramené dans [0, π]. */
function angleGap(a: number, b: number): number {
  const d = Math.abs(a - b) % (Math.PI * 2)
  return Math.min(d, Math.PI * 2 - d)
}

/** Ce qu'on demande à la case suivante (cf. `grow`). */
interface GrowOpts {
  /**
   * Cap de la branche, en radians. Absent, la branche pousse au plus court sans
   * direction propre : c'est ce qu'il faut pour une alvéole SEULE, qui n'a pas de
   * branche à tenir.
   */
  heading?: number
  /**
   * Prendre la case libre la plus LOINTAINE du bord plutôt que la plus proche.
   * C'est ainsi que se pose un jalon : au bout, et pas dans un creux.
   */
  far?: boolean
}

/** La case libre du bord de `from` qui minimise `score`, s'il en reste une. */
function bestFree(
  from: readonly Coord[],
  taken: Set<string>,
  score: (q: number, r: number) => number,
): Coord | null {
  let best: Coord | null = null
  let bestScore = Number.POSITIVE_INFINITY
  const seen = new Set<string>()
  for (const [q, r] of from) {
    for (const [dq, dr] of NEIGHBORS) {
      const nq = q + dq
      const nr = r + dr
      const k = key(nq, nr)
      // La ruche n'est pas une case libre : elle ne s'achète pas.
      if ((nq === 0 && nr === 0) || taken.has(k) || seen.has(k)) continue
      seen.add(k)
      const s = score(nq, nr)
      if (s < bestScore) {
        bestScore = s
        best = [nq, nr]
      }
    }
  }
  return best
}

/**
 * Choisit la prochaine alvéole d'un ensemble en croissance.
 *
 * @param grown les cases déjà tenues par la branche (son point d'attache compris)
 * @param taken l'occupation de TOUT le rayon
 * @param all TOUT le rayon, pour le cas où la branche serait murée (cf. plus bas)
 */
function grow(
  grown: readonly Coord[],
  taken: Set<string>,
  opts: GrowOpts,
  all: readonly Coord[],
): Coord {
  const best = bestFree(grown, taken, (q, r) => {
    const { x, y } = center(q, r)
    const dist = Math.hypot(x, y)
    const bias =
      opts.heading === undefined ? 0 : ANG_WEIGHT * angleGap(Math.atan2(y, x), opts.heading)
    return (opts.far ? -dist : dist) + bias
  })
  if (best) return best

  // BRANCHE MURÉE. Le plan hexagonal est infini, mais le bord d'une branche, lui,
  // ne l'est pas : à neuf branches qui poussent en alternance, il arrive qu'une
  // file mince se retrouve enfermée par ses voisines, chacune de ses cases ayant
  // ses six voisines prises. Elle ne meurt pas pour autant — elle REPART DE
  // L'AUTRE CÔTÉ DU MUR : la case libre du rayon la plus proche de sa pointe.
  //
  // C'est ce qui fait tenir la promesse « n'importe quel nombre d'alvéoles » : la
  // seule façon d'échouer serait que le rayon ENTIER n'ait plus de bord libre, ce
  // qu'un ensemble fini ne peut pas faire. Et comme la case reprise touche
  // forcément une alvéole existante, le dévoilement de proche en proche (§7.2 du
  // GDD) reste vrai — le rayon n'a pas d'île.
  const tip = grown[grown.length - 1] ?? [0, 0]
  const from = center(tip[0], tip[1])
  const detour = bestFree(all, taken, (q, r) => {
    const { x, y } = center(q, r)
    return Math.hypot(x - from.x, y - from.y)
  })
  if (!detour) throw new Error('comb: plus une seule case libre au bord du rayon')
  return detour
}

// --- LE GRIND ---------------------------------------------------------------
//
// Neuf branches, 110 alvéoles, cinq THÈMES. Aucune ne déverrouille quoi que
// ce soit : elles font monter un chiffre de 0,5 % à 5 % à la fois. C'est le
// corps du jeu de long terme — ce qu'on achète en regardant ailleurs.
//
// Ce qui se décide ici n'est donc pas une alvéole mais une COURBE : combien de
// crans, et à quelle vitesse le prix double. Trois nombres par branche.

/**
 * Longueurs des branches du grind. AUCUNE NE DÉPASSE QUINZE CRANS.
 *
 * C'est une contrainte de LISIBILITÉ, et elle prime sur le nombre total
 * d'alvéoles. Un rang s'affiche en chiffres romains : « XV » se lit, « XXXVII »
 * se déchiffre. Et une branche de cinquante crans n'est pas cinquante décisions,
 * c'est une décision suivie de quarante-neuf clics — le joueur qui achète le
 * quarantième cran de la même chose ne choisit plus rien.
 *
 * Huit pour les branches qui règlent (elles ont besoin d'amplitude), six pour
 * celles qui donnent des abeilles ou du temps de vol (chaque cran y pèse déjà
 * lourd).
 *
 * HUIT ET SIX, ET PAS QUINZE ET DIX : c'est la DURÉE DE PARTIE qui les fixe. Une
 * partie doit tenir en deux heures, et le temps d'un rayon est d'abord un nombre
 * d'ACHATS — chaque alvéole coûte à peu près la même attente que la précédente,
 * puisque prix et production montent ensemble. Quinze et dix donnaient un rayon
 * de 166 alvéoles qu'aucune courbe de production ne rattrapait : on l'a mesuré à
 * soixante-dix heures. Baisser les prix n'y changeait rien, c'est le NOMBRE qui
 * commande. Huit et six font 118 alvéoles, et deux heures.
 */
const GRIND_TIERS = {
  microNaps: 8,
  slowRipening: 8,
  aerodynamics: 8,
  deepRoots: 6,
  frenzy: 6,
  synergy: 8,
  queenMother: 6,
  workerQueen: 6,
  patrols: 6,
} as const

/**
 * Prix en miel d'un cran : `base × croissance^(n-1)`.
 *
 * Le miel n'a pas de plafond : sa courbe peut être aussi raide qu'on veut sans
 * jamais bloquer personne, seulement faire attendre. La croissance dit donc à
 * quel rythme la branche décroche du reste du jeu.
 *
 * Les croissances ne sont plus choisies branche par branche : elles se DÉDUISENT
 * d'un même écart, `SPAN`, entre le premier cran et le dernier. Une branche de
 * huit crans croît donc en `SPAN^(1/7)` ≈ 1,63, une de six en `SPAN^(1/5)` ≈
 * 1,97 — la branche courte monte plus vite parce qu'elle a moins de marches pour
 * faire le même chemin. C'est ce qui garde les branches COMPARABLES quand on
 * change leur longueur : `GRIND_TIERS` se retouche sans rouvrir sept nombres.
 */
/**
 * Écart entre le premier cran d'une branche et le dernier. C'est LE nombre de
 * l'équilibrage de fin de partie : le rayon coûte 188 k de miel, et à trente le
 * dernier cran d'une branche vaut trente fois le premier — assez pour que la
 * courbe se sente, pas assez pour qu'elle décroche. Cf. `GRIND_TIERS` pour
 * l'autre moitié du calcul (le nombre d'achats).
 */
const SPAN = 30
const honeyGrowth = (tiers: number): number => SPAN ** (1 / (tiers - 1))
function honeyCurve(base: number, growth: number, tier: number): number {
  return Math.round(base * growth ** (tier - 1))
}

/**
 * Prix en nectar d'un cran : la COURBE DU PLAFOND, à une fraction près.
 *
 * Le nectar est plafonné par une quadratique (`getNectarCapacity`), et c'est la
 * branche « réserve » qui la fait monter. Un prix en nectar qui suivrait sa
 * propre courbe finirait forcément par la croiser ; celui-ci ne peut pas, il EST
 * la même courbe multipliée par une fraction inférieure à un. La dernière
 * alvéole d'une branche coûte donc `share` du plafond ultime, et pas un nectar de
 * plus — quelle que soit la longueur qu'on donne à la branche.
 */
function nectarCurve(share: number, tier: number, tiers: number): number {
  const level = (STORAGE_TIERS * tier) / tiers
  return Math.min(NECTAR_CEILING, Math.round(getNectarCapacity(level) * share))
}

interface BranchSpec {
  kind: UpgradeKind
  /** Nombre de crans (cf. `GRIND_TIERS`). */
  tiers: number
  /** Alvéole existante contre laquelle la branche s'amorce. */
  anchor: string
  /** Cap de croissance, en degrés (0 = droite, 90 = bas, cf. l'écran). */
  heading: number
  cost: (tier: number, tiers: number) => Cost
  /**
   * Abeilles versées par cran, s'il y en a (cf. `CELL_BEE_KIND`). Une fonction
   * quand le versement CROÎT avec le cran : une branche dont le prix double à
   * chaque pas et qui rend toujours la même chose s'arrête d'elle-même.
   */
  bees?: number | ((tier: number) => number)
}

const GRIND: readonly BranchSpec[] = [
  // WAX ARCHITECTURE — la cire et le temps qu'elle prend. Deux branches qui se
  // répondent : l'une raccourcit le lot, l'autre l'allonge en le rendant plus
  // riche. Les acheter toutes les deux n'est pas une contradiction, c'est le
  // réglage — et c'est au joueur de savoir où il place son curseur.
  {
    kind: 'microNaps',
    tiers: GRIND_TIERS.microNaps,
    anchor: 'fanning-4',
    heading: -55,
    cost: (n, t) => ({ honey: honeyCurve(60, honeyGrowth(t), n) }),
  },
  {
    kind: 'slowRipening',
    tiers: GRIND_TIERS.slowRipening,
    anchor: 'ripening-4',
    heading: -160,
    cost: (n, t) => ({ honey: honeyCurve(120, honeyGrowth(t), n) }),
  },

  // ADVANCED BOTANY — le pré et le vol. Tout s'y paie en NECTAR, et donc sous le
  // plafond : ces deux branches-là se gagnent en volant, pas en attendant.
  {
    kind: 'aerodynamics',
    tiers: GRIND_TIERS.aerodynamics,
    anchor: 'flight-6',
    heading: 70,
    cost: (n, t) => ({ nectar: nectarCurve(0.6, n, t) }),
  },
  {
    kind: 'deepRoots',
    tiers: GRIND_TIERS.deepRoots,
    anchor: 'growth-6',
    heading: 180,
    cost: (n, t) => ({ nectar: nectarCurve(0.5, n, t) }),
  },

  // PHEROMONES — ce que la colonie se dit d'elle-même. La frénésie allonge le
  // tour, la synergie multiplie l'ouvrière : l'une touche au pilotage, l'autre à
  // la ruche, et la première se paie donc dans les deux monnaies.
  {
    kind: 'frenzy',
    tiers: GRIND_TIERS.frenzy,
    anchor: 'thrift-4',
    heading: 120,
    cost: (n, t) => ({ honey: honeyCurve(150, honeyGrowth(t), n), nectar: nectarCurve(0.3, n, t) }),
  },
  {
    kind: 'synergy',
    tiers: GRIND_TIERS.synergy,
    anchor: 'foragers-3',
    heading: -20,
    cost: (n, t) => ({ honey: honeyCurve(200, honeyGrowth(t), n) }),
  },

  // GENETICS — ce dont la ruche hérite. Les deux branches les plus chères du
  // rayon, et les seules qui donnent des ABEILLES au cran : la reine mère verse
  // des butineuses fantômes (le trajet est le même, il rapporte plus), la reine
  // ouvrière verse des ouvrières bien réelles.
  {
    kind: 'queenMother',
    tiers: GRIND_TIERS.queenMother,
    anchor: 'storage-15',
    heading: -120,
    cost: (n, t) => ({
      honey: honeyCurve(500, honeyGrowth(t), n),
      nectar: nectarCurve(0.35, n, t),
    }),
  },
  {
    kind: 'workerQueen',
    tiers: GRIND_TIERS.workerQueen,
    anchor: 'workers-4',
    heading: -90,
    cost: (n, t) => ({ honey: honeyCurve(400, honeyGrowth(t), n) }),
    // Le cran verse SON RANG d'ouvrières : une au premier, dix au dixième, 55 en
    // tout. Son prix DOUBLE à chaque cran (base 2) — un versement fixe faisait
    // du dernier cran, à cinq cents fois le prix du premier, exactement le même
    // gain que lui. C'est la branche qui porte l'effectif de fin de partie, et
    // l'effectif est le seul terme que la synergie multiplie : les deux
    // ensemble sont ce qui rend la courbe du miel quadratique plutôt que plate.
    bees: (tier) => tier,
  },

  // DÉFENSE SPATIALE — la seule branche du rayon qui joue sur le DIVISEUR. Une
  // guerrière de plus, c'est deux pixels de périmètre de dépôt de plus (cf.
  // `guardRadiusPx`) : le tour se clôt un peu plus tôt, à butin égal. Rien n'est
  // rétroactif — le trajet déjà enregistré a été volé jusqu'à l'ancien périmètre
  // et garde sa note. Pour toucher le raccourci, il faut REPRENDRE LA SOURIS.
  // C'est ce qui en fait une branche de fin de partie et non un compteur de plus.
  {
    kind: 'patrols',
    tiers: GRIND_TIERS.patrols,
    anchor: 'foragers-3',
    heading: 40,
    cost: (n, t) => ({ honey: honeyCurve(500, honeyGrowth(t), n) }),
    bees: 1,
  },
] as const

// --- LES JALONS ET LES PIÈGES -----------------------------------------------
//
// Dix alvéoles écrites une par une. Leur PLACE est calculée comme le reste (il
// n'y a qu'une géométrie dans ce fichier), mais leur effet et leur prix sont
// pesés à la main : chacune retourne une règle du jeu, ou fait semblant.
//
// Les JALONS se posent au BOUT de la branche qu'ils couronnent : la dernière
// alvéole d'une branche de vingt crans est le seul endroit du rayon où l'on
// puisse mettre une récompense de plusieurs jours sans qu'elle tombe trop tôt.
//
// Les PIÈGES, eux, se posent TOUT PRÈS de la ruche, contre les branches du début
// de partie. C'est indispensable : un piège qu'on ne rencontre qu'à la fin
// n'apprend rien. Celui-ci se rencontre tôt, et il coûte assez pour se sentir —
// le joueur qui lit ce qu'il achète y coupe, l'autre paie sa leçon. Aucun d'eux
// ne ferme quoi que ce soit : ils sont en bout de course, rien ne pousse derrière.

interface SoloSpec {
  kind: UpgradeKind
  /** Branche (jalon) ou alvéole (piège) contre laquelle l'alvéole se pose. */
  against: UpgradeKind
  cost: Cost
  bees?: number
}

const MILESTONES: readonly SoloSpec[] = [
  // Le bout de la Reine Mère : elle versait des fantômes au cran, celle-ci en
  // verse au PRORATA des ouvrières. La ruche et le pré cessent d'être deux
  // moitiés séparées — pour la première fois, embaucher à l'intérieur fait voler
  // plus fort dehors. Prix à l'avenant : le miel d'un cap de branche, et le
  // plafond de nectar au complet.
  { kind: 'frenzyDance', against: 'queenMother', cost: { honey: 12_500, nectar: NECTAR_CEILING } },
  // Le bout des Racines Profondes : le « Perfect » passe de x2 à x3. C'est le
  // seul nœud du jeu qui récompense le PILOTAGE et rien d'autre — il ne vaut que
  // ce que vaut le trajet du joueur, et pour un trajet quelconque il ne vaut rien.
  { kind: 'mutantCorollas', against: 'deepRoots', cost: { honey: 7_500 } },
  // Le bout de l'Aérodynamisme : la gelée royale tombe 20 % plus tôt, donc la
  // lignée entière avance plus vite. Il demande d'avoir mené la réserve au bout,
  // et le dit par son prix : le plafond ultime, en entier.
  {
    kind: 'royalDigestion',
    against: 'aerodynamics',
    cost: { honey: 4_000, nectar: NECTAR_CEILING },
  },
  // Le bout de la Frénésie : l'inertie de l'abeille disparaît à 95 %. Trophée de
  // pilotage, et rien d'autre — il ne rapporte pas un nectar de plus, il rend
  // seulement possible le trajet qu'on n'arrivait pas à tracer.
  { kind: 'zeroInertia', against: 'frenzy', cost: { honey: 25_000 } },
  // Le bout de la Reine Ouvrière : l'essaimage cesse de tout prendre. Le seul
  // nœud du rayon qui SURVIVE au rayon — et donc le seul qui pousse à retarder
  // le prestige au lieu de le précipiter.
  { kind: 'goldenSwarm', against: 'workerQueen', cost: { honey: 15_000 } },
  // Le bout de la Maturation Lente : une fleur annonce son ouverture. Il ne
  // change aucun chiffre, il change ce que le joueur VOIT — et c'est ce qui fait
  // les meilleurs trajets. Payé au nectar, juste sous le plafond ultime.
  { kind: 'floralClock', against: 'slowRipening', cost: { nectar: NECTAR_CEILING } },
  // Le bout des Patrouilles : dix guerrières d'un coup, donc VINGT PIXELS de
  // périmètre en une alvéole. C'était un piège — une figuration payante — et
  // c'est devenu le jalon qui rend le « touch-and-go » possible : la butineuse
  // n'a plus besoin de rentrer, elle FRÔLE. Il ne se lit que la souris à la
  // main : acheté puis oublié, il ne change pas un chiffre du trajet en cours.
  { kind: 'honorGuard', against: 'patrols', cost: { honey: 2_000 }, bees: 10 },
] as const

const TRAPS: readonly SoloSpec[] = [
  // Un bonus ADDITIF au milieu d'un jeu multiplicatif : 0,1 nectar par vol, pour
  // toujours. Excellent au premier tour, risible au centième. Le prix est calé
  // pour être tentant au moment où on le croise — c'est tout l'objet.
  { kind: 'heavyPollen', against: 'foragers', cost: { honey: 125 } },
  // Des paillettes sur la ruche. Aucune mécanique, et le prix d'un vrai nœud :
  // c'est un achat qu'on fait pour soi.
  { kind: 'shinyWax', against: 'ripening', cost: { nectar: 30_000 } },
  // Le bourdonnement descend d'un demi-ton. Il faut l'entendre pour y croire.
  { kind: 'dullBuzz', against: 'flight', cost: { honey: 300 } },
] as const

// --- ASSEMBLAGE -------------------------------------------------------------

function buildComb(): CombCell[] {
  const cells: CombCell[] = [...storageCells(), ...HAND_PLACED]
  const taken = new Set(cells.map((c) => key(c.q, c.r)))
  /** Les cases tenues par chaque branche : c'est par là qu'elle pousse. */
  const grown = new Map<UpgradeKind, Coord[]>()
  for (const c of cells) {
    const list = grown.get(c.kind) ?? []
    list.push([c.q, c.r])
    grown.set(c.kind, list)
  }

  const place = (
    kind: UpgradeKind,
    tier: number,
    cost: Cost,
    from: readonly Coord[],
    opts: GrowOpts,
    bees?: number,
  ): void => {
    const [q, r] = grow(
      from,
      taken,
      opts,
      cells.map((c) => [c.q, c.r] as Coord),
    )
    taken.add(key(q, r))
    cells.push(assertPayable({ id: `${kind}-${String(tier)}`, kind, tier, cost, q, r, bees }))
    const list = grown.get(kind) ?? []
    list.push([q, r])
    grown.set(kind, list)
  }

  // 1. LES PIÈGES D'ABORD. Ils prennent la case libre la plus PROCHE de la ruche
  //    au bord de leur branche d'accueil : servis en premier, ils sont sûrs de
  //    tomber tôt dans la partie, avant que le grind ne remplisse le voisinage.
  for (const trap of TRAPS) {
    const from = grown.get(trap.against)
    if (!from) throw new Error(`comb: le piège ${trap.kind} s'accroche à une branche inconnue`)
    place(trap.kind, 1, trap.cost, from, {}, trap.bees)
  }

  // 2. LE GRIND, EN ALTERNANCE. Un cran par branche et par tour : les neuf
  //    branches se repoussent au lieu de se servir dans l'ordre du tableau.
  //
  //    Le point d'attache appartient à une AUTRE branche : il sert de départ à la
  //    croissance sans jamais être compté comme une alvéole de celle-ci. C'est ce
  //    qui garantit le dévoilement — la première alvéole du grind touche une
  //    alvéole du début de partie, et se montre donc dès que celle-ci est bâtie.
  for (const spec of GRIND) {
    const anchor = cells.find((c) => c.id === spec.anchor)
    if (!anchor)
      throw new Error(`comb: la branche ${spec.kind} s'amorce sur ${spec.anchor}, absent`)
    grown.set(spec.kind, [[anchor.q, anchor.r]])
  }
  const longest = Math.max(...GRIND.map((s) => s.tiers))
  for (let tier = 1; tier <= longest; tier++) {
    for (const spec of GRIND) {
      if (tier > spec.tiers) continue
      const from = grown.get(spec.kind)
      if (!from) continue
      place(
        spec.kind,
        tier,
        spec.cost(tier, spec.tiers),
        from,
        { heading: (spec.heading * Math.PI) / 180 },
        typeof spec.bees === 'function' ? spec.bees(tier) : spec.bees,
      )
    }
  }

  // 3. LES JALONS EN DERNIER, au bout de leur branche : la case libre la plus
  //    LOINTAINE de son bord. C'est le seul endroit du rayon dont on soit sûr
  //    qu'il ne se traverse pas par accident.
  for (const node of MILESTONES) {
    const from = grown.get(node.against)
    if (!from) throw new Error(`comb: le jalon ${node.kind} couronne une branche inconnue`)
    place(node.kind, 1, node.cost, from, { far: true }, node.bees)
  }

  return cells
}

export const COMB: readonly CombCell[] = buildComb()

/** Nombre d'alvéoles achetables au total (jauge du bouton d'accès). */
export const COMB_TOTAL = COMB.length

/**
 * Les alvéoles par coordonnée. Le dévoilement interroge les six voisines de
 * chaque alvéole à chaque frame : la recherche linéaire refaisait un balayage de
 * tout le rayon six fois par alvéole, pour un résultat qui ne change qu'à l'achat.
 */
const CELL_AT = new Map<string, CombCell>(COMB.map((c) => [key(c.q, c.r), c]))

/** L'alvéole posée en (q, r), s'il y en a une. */
export function cellAt(q: number, r: number): CombCell | undefined {
  return CELL_AT.get(key(q, r))
}

/** L'alvéole d'identifiant donné, pour les effets qui en nomment une (jalons). */
const CELL_BY_ID = new Map<string, CombCell>(COMB.map((c) => [c.id, c]))
export function cellById(id: string): CombCell | undefined {
  return CELL_BY_ID.get(id)
}

/**
 * MONNAIE PRINCIPALE d'une alvéole : le miel dès qu'il en faut, le nectar sinon.
 *
 * Elle ne sert PAS à payer (un prix mixte se paie dans les deux, cf. `Cost`),
 * seulement à ranger : c'est elle qui décide de quel côté du rayon une alvéole
 * appartient — donc de ce dont hérite la lignée, et du moment où l'alvéole se
 * montre. Une alvéole mixte est rangée du côté du miel parce que c'est le miel
 * qui la retient : elle n'a aucun sens avant que la ruche transforme.
 */
export function mainCurrency(cell: CombCell): Currency {
  return cell.cost.honey === undefined ? 'nectar' : 'honey'
}

/** Les monnaies effectivement demandées par une alvéole, dans l'ordre d'affichage. */
export function costLines(cost: Cost): { currency: Currency; amount: number }[] {
  const lines: { currency: Currency; amount: number }[] = []
  if (cost.nectar !== undefined) lines.push({ currency: 'nectar', amount: cost.nectar })
  if (cost.honey !== undefined) lines.push({ currency: 'honey', amount: cost.honey })
  return lines
}

/**
 * RANG DE PRIX d'une alvéole, sans unité, pour trier des prix qui ne se comparent
 * pas (cf. `GameState.buyAllAffordable`).
 *
 * Chaque monnaie est ramenée à ce qu'elle représente d'un plein : le nectar par
 * le plafond ultime, le miel par un ordre de grandeur de fin de partie. Un
 * millier de nectar et un millier de miel ne valent pas la même chose, et ce
 * ratio le dit — approximativement, ce qui suffit : il ne décide de rien d'autre
 * que de l'ordre dans lequel un achat groupé vide les deux bourses.
 */
const HONEY_SCALE = 500_000
export function costRank(cost: Cost): number {
  return (cost.nectar ?? 0) / NECTAR_CEILING + (cost.honey ?? 0) / HONEY_SCALE
}

/**
 * Effet d'UN niveau de chaque branche.
 *
 * La réserve n'y figure plus : son effet n'est pas un pas mais une COURBE
 * (`getNectarCapacity`), et c'est cette courbe qui décide si le rayon est
 * finissable. Tout ce qui se paie en nectar est PLAFONNÉ — une alvéole plus chère
 * que la réserve du moment est hors d'atteinte, le joueur butine et la réserve
 * sature avant le prix. Le plafond monte donc 100 / 400 / 1100 / 2200 / 3700 /
 * 5600…, jusqu'à 46 600 au quinzième palier, et c'est `assertPayable` qui garantit
 * que rien du rayon ne passe au-dessus.
 *
 * Le miel, lui, n'a pas de plafond : les alvéoles de la ruche ne connaissent pas
 * cette contrainte, seulement l'attente.
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
   * la branche la plus chère du début de partie, et c'est normal — elle multiplie
   * tout le reste.
   */
  ripeningStep: 0.5,

  // --- Le grind -----------------------------------------------------------

  /**
   * Micro-siestes : le lot raccourcit de 1 % PAR CRAN, multiplicativement. Quarante
   * crans le ramènent à 67 % de sa durée — jamais à zéro, c'est tout l'intérêt
   * d'un facteur : la branche peut être longue sans jamais casser la mécanique.
   */
  microNapMult: 0.99,
  /**
   * Maturation lente : le lot rend 4 % de miel de plus ET dure 3 % de plus, par
   * cran, additivement. Le gain net est positif (4 > 3) mais MINCE, et il paie
   * en RYTHME : la ruche tourne de plus en plus lentement, la jauge au-dessus
   * d'elle devient une horloge. C'est le seul endroit du jeu où améliorer rend le
   * jeu moins vivant, et le joueur a le droit de s'arrêter là.
   */
  slowHoneyStep: 0.04,
  slowBatchStep: 0.03,
  /** Aérodynamisme : 0,5 % de vitesse de vol par cran, additif comme `flightStep`. */
  aeroStep: 0.005,
  /** Racines profondes : 2 % de repos en moins par cran, multiplicatif. */
  deepRootsMult: 0.98,
  /** Frénésie butineuse : une demi-seconde de tour en plus par cran. */
  frenzyMs: 500,
  /**
   * Synergie ouvrière : +5 % au rendement de base d'une ouvrière par cran,
   * MULTIPLICATIVEMENT (comme les micro-siestes et les racines profondes).
   * Quinze crans font ×2,08 au lieu de ×1,75 — l'écart est mince, mais un pas
   * additif SATURE : le quinzième cran d'un « 1 + n × pas » vaut moins que le
   * premier, alors qu'il coûte sept cents fois plus cher. Ce que la ruche se dit
   * d'elle-même se répète, il ne s'additionne pas.
   */
  synergyMult: 1.35,
  /** Reine mère : une butineuse fantôme par cran (elle vole le trajet sans être dessinée). */
  ghostPerQueenTier: 1,
  /**
   * PATROUILLES : pixels de périmètre de dépôt gagnés PAR GUERRIÈRE (cf.
   * `HIVE.depositRadius`). Deux pixels, c'est peu à l'unité et c'est voulu : ce
   * n'est pas un gain, c'est une INVITATION à revoler le tour. Vingt guerrières
   * — les dix crans plus le jalon — font quarante pixels, soit un huitième de
   * seconde de vol de retour en moins : à butin égal, une meilleure note.
   */
  guardRadiusPx: 2,

  // --- Les jalons ---------------------------------------------------------

  /** Danse frénétique : une butineuse fantôme par tranche d'ouvrières possédées. */
  danceWorkersPerGhost: 10,
  /** Corolles mutantes : ce que vaut un « Perfect » (au lieu de `FLOWER.perfectMultiplier`). */
  mutantPerfect: 3,
  /** Digestion royale : le palier de gelée royale, multiplié par ceci. */
  digestionMult: 0.8,
  /** Inertie zéro : le lissage de l'abeille, multiplié par ceci (95 % d'inertie en moins). */
  zeroInertiaMult: 20,
  /** Essaimage doré : part du miel que la lignée emporte au-delà de l'essaimage. */
  goldenSwarmKeep: 0.1,

  // --- Les pièges ---------------------------------------------------------

  /** Pollen lourd : nectar ADDITIF par vol. Il ne suit aucun multiplicateur, c'est le piège. */
  heavyPollenNectar: 0.1,
  /** Bourdonnement sourd : désaccord du son de butinage, en centièmes de demi-ton. */
  dullBuzzDetune: -120,
} as const

// Les rangs se lisent en chiffres romains, et les branches du grind vont jusqu'à
// XL : une table écrite à la main s'arrêtait à VI et rendait `undefined` au-delà.
// La table de chiffres va bien plus loin, pour que rallonger une branche reste un
// seul nombre à changer.
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
