// Mise en forme des nombres affichés à l'écran.

/** Abrège un nombre : 8.4, 942, 1.2k, 3.5M… */
export function fmt(n: number): string {
  if (n < 1000) return n.toFixed(n < 10 ? 1 : 0)
  const units = ['k', 'M', 'G', 'T']
  let u = -1
  do {
    n /= 1000
    u++
  } while (n >= 1000 && u < units.length - 1)
  return n.toFixed(1) + units[u]
}

/**
 * Comme `fmt`, mais pour ce qui se gagne par petites quantités : le miel tombe
 * par lots de 0,25, et « 0.3 » en ferait mentir le compte. Deux décimales sous
 * l'unité, l'abrégé ordinaire au-dessus.
 */
export function fmtFine(n: number): string {
  return n < 1 ? n.toFixed(2) : fmt(n)
}

/** Comme `fmt`, mais pour ce qui se compte à l'unité : 1, 7, 128, 1.2k. */
export function fmtCount(n: number): string {
  return n < 1000 ? `${Math.floor(n)}` : fmt(n)
}

/**
 * Seuil d'abréviation des GROS nombres. Plus haut que celui de `fmt` (1000) et
 * c'est voulu : les prix du rayon et la jauge de réserve sont des chiffres qu'on
 * COMPARE (« il me manque combien ? »), et « 1.4k » perd la centaine qui décide.
 * Au-delà de cinq chiffres, en revanche, le texte déborde de son alvéole ou de sa
 * ligne — l'abrégé devient le moindre mal.
 */
const ABBREV_FROM = 10000

/**
 * Un nombre entier tel qu'il s'affiche dans un CONTENANT étroit : exact jusqu'à
 * 9999, abrégé au-delà (`15.4k`). C'est la mise en forme des prix du rayon et de
 * la réserve, que la courbe quadratique de la branche « réserve » emmène à cinq
 * chiffres (46,6 k de contenance, 30,5 k pour la dernière alvéole).
 */
export function fmtBig(n: number): string {
  return n < ABBREV_FROM ? `${Math.floor(n)}` : fmt(n)
}
