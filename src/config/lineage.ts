// LA LIGNÉE DE LA REINE — l'arbre de prestige.
//
// Le rayon (cf. config/upgrades) est ce qu'une colonie bâtit ; la lignée est ce
// qu'elle LÈGUE. Tout s'y paie en gelée royale, et rien ne s'y perd : la gelée
// non dépensée, les nœuds déjà acquis et le compte des reines traversent
// l'essaimage. C'est la seule chose du jeu qui survive à une remise à zéro.
//
// TROIS RÈGLES, et elles expliquent chaque nœud ci-dessous :
//
//   1. **Un nœud ne joue jamais le tour à la place du joueur.** Le pilotage est
//      la seule chose que le joueur maîtrise vraiment ; une lignée qui rendrait
//      un bon trajet automatique viderait l'enregistrement de son intérêt. Ce
//      qui touche au vol (`steady`, `longDay`, `keenEye`) est donc minuscule :
//      un cran de confort, jamais une dispense.
//
//   2. **Un nœud fait GAGNER DU TEMPS, il ne dépasse pas les plafonds.** Les
//      lignées `nectarStart` / `honeyStart` ne donnent rien qu'une colonie ne
//      puisse acheter elle-même : elles donnent les mêmes alvéoles, PLUS TÔT.
//      Une deuxième partie ne recommence donc pas au même endroit, mais elle ne
//      dépasse pas non plus le plafond de la première.
//
//   3. **Un nœud se lit sur le pré ou sur le rayon.** Une fleur de plus se voit,
//      une seconde de plus se voit, un bouton « Buy all » se voit. Un
//      multiplicateur caché ne serait qu'un chiffre qui monte.

/**
 * Les branches de la lignée. Une branche = un effet, un ou plusieurs paliers,
 * qui s'achètent dans l'ordre.
 */
export type LineageKind =
  | 'nectarBlood'
  | 'honeyBlood'
  | 'busyWax'
  | 'wideMeadow'
  | 'steadyWings'
  | 'longDays'
  | 'keenEye'
  | 'richBloom'
  | 'quickRoots'

export interface LineageNode {
  /** Identifiant stable, persisté en sauvegarde (`wideMeadow-2`…). */
  id: string
  kind: LineageKind
  /** Rang dans sa branche, à partir de 1. Le rang précédent est son prérequis. */
  tier: number
  /** Prix en GELÉE ROYALE. Un nœud s'achète une fois, et pour toujours. */
  cost: number
}

/**
 * L'arbre, branche par branche. L'ordre de ce tableau est celui de l'affichage :
 * les deux lignées d'héritage d'abord (ce sont elles qui font le saut le plus
 * franc), puis le confort du rayon, puis le pré, puis le vol.
 *
 * LES PRIX. La gelée tombe par doses de 0,5 tous les 50 miel : une première
 * colonie menée jusqu'au bout de son rayon en rapporte quelques unités, pas
 * quelques dizaines. Un premier essaimage doit donc pouvoir s'offrir UN nœud
 * d'entrée (1 ou 2) et pas davantage — sinon l'arbre se solderait d'un coup et
 * n'aurait plus rien à raconter au troisième tour. Les rangs suivants montent
 * vite (à peu près le double), parce que la colonie qui les vise part elle-même
 * d'un héritage : elle produit plus, elle paie plus.
 */
export const LINEAGE: readonly LineageNode[] = [
  // Héritage du rayon en nectar : réserve, vol, pousse, première butineuse,
  // première ouvrière. C'est le nœud qui change le plus la première heure d'une
  // colonie — le rang III installe une ruche qui transforme déjà.
  { id: 'nectarBlood-1', kind: 'nectarBlood', tier: 1, cost: 1 },
  { id: 'nectarBlood-2', kind: 'nectarBlood', tier: 2, cost: 3 },
  { id: 'nectarBlood-3', kind: 'nectarBlood', tier: 3, cost: 6 },

  // Héritage du rayon en miel : ventilation, économie, maturation, effectifs.
  // Plus cher que le nectar à rang égal : ces alvéoles-là se paient normalement
  // dans une monnaie qui n'a pas de plafond, et les hériter saute une boucle
  // entière (miel → ouvrières → miel).
  { id: 'honeyBlood-1', kind: 'honeyBlood', tier: 1, cost: 2 },
  { id: 'honeyBlood-2', kind: 'honeyBlood', tier: 2, cost: 5 },
  { id: 'honeyBlood-3', kind: 'honeyBlood', tier: 3, cost: 9 },

  // Le bouton « Buy all » du rayon. Ce n'est pas une amélioration de puissance :
  // c'est le clic répété qu'on retire à un joueur qui a déjà bâti ce rayon-là
  // une fois. Un seul palier, forcément.
  { id: 'busyWax-1', kind: 'busyWax', tier: 1, cost: 2 },

  // Une fleur de plus au pré, définitivement. Le tour de référence en croise
  // davantage sans être plus long : c'est du nectar/s gagné sur le terrain,
  // pas sur l'abeille.
  { id: 'wideMeadow-1', kind: 'wideMeadow', tier: 1, cost: 2 },
  { id: 'wideMeadow-2', kind: 'wideMeadow', tier: 2, cost: 4 },
  { id: 'wideMeadow-3', kind: 'wideMeadow', tier: 3, cost: 7 },

  // Le pré, encore : des corolles plus riches et des repousses plus courtes.
  // Trois rangs chacune, parce que ces deux branches se lisent directement sur
  // le pré (une corolle plus grasse, une tige qui repousse) et qu'un seul cran
  // se noyait dans le bruit d'un tour.
  { id: 'richBloom-1', kind: 'richBloom', tier: 1, cost: 3 },
  { id: 'richBloom-2', kind: 'richBloom', tier: 2, cost: 6 },
  { id: 'richBloom-3', kind: 'richBloom', tier: 3, cost: 11 },
  { id: 'quickRoots-1', kind: 'quickRoots', tier: 1, cost: 3 },
  { id: 'quickRoots-2', kind: 'quickRoots', tier: 2, cost: 6 },
  { id: 'quickRoots-3', kind: 'quickRoots', tier: 3, cost: 11 },

  // Le vol. Les trois nœuds les plus prudents de l'arbre (cf. règle 1) : de
  // l'inertie en moins, une seconde de plus, une fenêtre « Perfect » un peu plus
  // large. Aucun ne vole le tour à la place du joueur : `keenEye` monte jusqu'au
  // rang III, mais 0,05 de fraîcheur à la fois — la fenêtre reste un geste.
  { id: 'steadyWings-1', kind: 'steadyWings', tier: 1, cost: 2 },
  { id: 'longDays-1', kind: 'longDays', tier: 1, cost: 3 },
  { id: 'longDays-2', kind: 'longDays', tier: 2, cost: 6 },
  { id: 'keenEye-1', kind: 'keenEye', tier: 1, cost: 4 },
  { id: 'keenEye-2', kind: 'keenEye', tier: 2, cost: 8 },
  { id: 'keenEye-3', kind: 'keenEye', tier: 3, cost: 14 },
] as const

/** Nombre de nœuds au total (jauge de l'écran de lignée). */
export const LINEAGE_TOTAL = LINEAGE.length

/**
 * Effet d'UN palier de chaque branche.
 *
 * `nectarBlood` et `honeyBlood` versent des alvéoles du rayon : leur palier est
 * une PORTÉE, lue dans `BLOOD_RADIUS`, et c'est `GameState.applyLineage` qui les
 * verse.
 */
/**
 * PORTÉE HÉRITÉE, par palier de sang (I, II, III) : la distance au centre du
 * rayon jusqu'où les alvéoles sont versées (cf. `combDistance`).
 *
 * Une distance, pas un rang de branche : le rang disait « la deuxième alvéole de
 * chaque branche », et certaines branches ont leur deuxième alvéole à six
 * couronnes du centre — la lignée bâtissait alors des îlots injoignables. La
 * portée dit « tout ce qui est à N alvéoles de la reine », donc toujours un
 * disque plein autour du centre.
 *
 * Les paliers ne se suivent pas d'un pas régulier (1, 2, 4) : les couronnes ne
 * portent pas le même nombre d'alvéoles, et le troisième palier — le plus cher
 * de la branche — doit s'en payer nettement plus que le deuxième.
 */
export const BLOOD_RADIUS = [1, 2, 4] as const

/** Portée héritée pour un nombre de paliers de sang. Zéro palier ne verse rien. */
export function bloodRadius(level: number): number {
  return level <= 0 ? 0 : (BLOOD_RADIUS[Math.min(level, BLOOD_RADIUS.length) - 1] ?? 0)
}

export const LINEAGE_EFFECT = {
  /**
   * Multiplicateur du lissage de l'abeille (cf. `BEE.lerp`). PLUS GRAND = moins
   * d'inertie : l'abeille rattrape le pointeur plus vite. 1,15 se sent dans un
   * virage serré et ne se voit nulle part ailleurs — au-delà, l'abeille colle au
   * curseur et le trajet parfait redevient une ligne brisée (cf. règle 1).
   */
  steadyLerpMult: 1.15,
  /** Rallonge du couperet du tour, par palier (10 s → 11 s → 12 s). */
  longDayMs: 1000,
  /**
   * Abaissement du seuil de fraîcheur d'un « Perfect », PAR PALIER (0,85 → 0,80
   * → 0,75 → 0,70). La récolte double reste un geste : même au rang III, il
   * reste les trois quarts de la corolle à ne pas manquer — c'est la marge qui
   * s'élargit, pas la règle qui tombe.
   */
  keenEyeFreshness: 0.05,
  /**
   * Hausse du nectar de base de TOUTES les fleurs, à l'ouverture de la corolle.
   * Se compose par palier (+10 %, +21 %, +33 %).
   */
  richBloomMult: 1.1,
  /**
   * Raccourcissement du temps de repos d'une fleur fanée (cf. `FLOWER.restMs`),
   * par palier : il en reste 70 %, puis 49 %, puis 34 %. Le pré tourne plus
   * vite, il ne cesse jamais de faner — une fleur cueillie se paie toujours.
   */
  quickRootsMult: 0.7,
  /**
   * Fleurs ajoutées au pré par palier de `wideMeadow`. Le RANG vaut le total :
   * le rang II donne six fleurs de plus, pas neuf.
   *
   * TROIS par palier, et non une : une corolle de plus sur dix-neuf ne se voyait
   * pas. Le pré est ce que le joueur REGARDE pendant tout le jeu — un héritage
   * qui le change doit se voir à l'œil dès la première seconde de la colonie
   * suivante, sinon il ne raconte rien. Au rang III le pré passe de dix-neuf à
   * vingt-huit fleurs : la prairie est visiblement plus dense, et le même trajet
   * croise plus de corolles sans durer une seconde de plus.
   */
  meadowPerTier: 3,
} as const

const ROMAN = ['', 'I', 'II', 'III'] as const

/** « II » pour le deuxième palier d'une branche ; rien si la branche est unique. */
export function lineageTierLabel(node: LineageNode): string {
  const branch = LINEAGE.filter((n) => n.kind === node.kind)
  return branch.length > 1 ? ROMAN[node.tier] : ''
}
