// Fleurs à butiner, découpées dans la planche « Tiny Garden » (objects.png).
//
// La planche fait 9 x 8 tuiles de 16 px. Les deux derniers stades de pousse
// occupent chacun DEUX lignes — un pied fait donc 16x32 :
//
//   lignes 0-1 : sachets de graines (décor de boutique, inutilisés ici)
//   ligne  2   : graine semée
//   ligne  3   : jeune pousse
//   lignes 4-5 : bouton  ← fleur fermée
//   lignes 6-7 : floraison ← fleur ouverte, celle qui se butine
//
// La 9e colonne est le nénuphar : il ne pousse que sur l'eau, on l'écarte.

import Phaser from 'phaser'
import { TEX } from './textures'

/** Côté d'une tuile de la planche. */
const TILE = 16
/** Hauteur d'un pied, en tuiles (tige + corolle). */
const PLANT_H = 2
/** Espèces plantables sur la terre ferme (la 9e, le nénuphar, est exclue). */
export const FLOWER_SPECIES = 8

/** Ligne du stade « bouton » / « floraison » dans la planche. */
const ROW_BUD = 4
const ROW_BLOOM = 6

/** Nom de frame du bouton de l'espèce `s`. */
export function budFrame(s: number): string {
  return `flower-bud-${s}`
}
/** Nom de frame de la corolle ouverte de l'espèce `s`. */
export function bloomFrame(s: number): string {
  return `flower-bloom-${s}`
}

/**
 * Découpe les deux stades utiles de chaque espèce en frames nommées. À appeler
 * une fois au boot, après le chargement de la planche.
 */
export function bakeFlowers(scene: Phaser.Scene): void {
  const texture = scene.textures.get(TEX.objects)
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST)

  for (let s = 0; s < FLOWER_SPECIES; s++) {
    const cuts: [string, number][] = [
      [budFrame(s), ROW_BUD],
      [bloomFrame(s), ROW_BLOOM],
    ]
    for (const [name, row] of cuts) {
      if (texture.has(name)) continue
      texture.add(name, 0, s * TILE, row * TILE, TILE, PLANT_H * TILE)
    }
  }
}
