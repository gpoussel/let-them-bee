// Générateur pseudo-aléatoire déterministe (LCG).
//
// Tout ce qui doit « avoir l'air aléatoire » sans jamais varier d'une partie à
// l'autre passe par ici : le décor du jardin, et surtout le calendrier des
// fleurs — un chronomètre ne vaut rien si le terrain change entre deux essais.

export function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}
