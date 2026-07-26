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
