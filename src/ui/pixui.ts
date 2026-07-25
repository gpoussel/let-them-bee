// Intégration de phaser-pixui (couche « brute », sans thème/atlas).
//
// pixui propose deux niveaux : des composants thémés (Button, Dialog…) qui
// exigent des atlas de textures, et des composants bruts (Container,
// ComponentFactory, BitmapText, Rectangle, Clickable) qui ne dépendent que
// d'une bitmap font. On utilise le second : layout par ANCRES responsive
// (coins de l'écran) tout en gardant notre bitmap font « monogram » bakée.
//
// Modèle de coordonnées pixui : chaque composant est attaché à un coin du
// parent (originX/originY = ancre), puis son offset (x, y) le décale VERS
// L'INTÉRIEUR depuis ce coin. Son propre origin définit son point d'alignement.

import Phaser from 'phaser'
import { Container, ComponentFactory, Rectangle, OriginX, OriginY } from 'phaser-pixui'
import { WORLD } from '../config/game'

export { OriginX, OriginY }

// La scène de jeu est en mode Scale.FIT sur une résolution fixe WORLD : la
// caméra met à l'échelle l'ensemble, donc le layout pixui travaille en
// coordonnées « monde » à zoom 1.
const ZOOM = 1

/**
 * Racine de layout pixui pour une scène. Ordre d'usage :
 *   const ui = new Ui(scene)
 *   ui.topLeft.bitmapText({ ... })   // on attache les composants…
 *   ui.commit()                      // …puis on fige le layout (une fois)
 * Après commit(), toute mutation (text, fillColor, setWidth…) repositionne
 * automatiquement le composant concerné.
 */
export class Ui {
  readonly root: Container
  private readonly factories = new Map<string, ComponentFactory>()

  constructor(private readonly scene: Phaser.Scene) {
    this.root = new Container(scene)
    // On mémorise l'ancre plein écran ; le layout effectif aura lieu au commit().
    this.root.reposition(
      {
        x: 0,
        y: 0,
        width: WORLD.width,
        height: WORLD.height,
        originX: OriginX.Left,
        originY: OriginY.Top,
      },
      ZOOM,
    )
  }

  /** Fabrique liée à un coin d'ancrage donné (mémoïsée). */
  at(originX: OriginX, originY: OriginY): ComponentFactory {
    const key = `${originX}:${originY}`
    let f = this.factories.get(key)
    if (!f) {
      f = new ComponentFactory({ scene: this.scene, originX, originY })
      f.setContainer(this.root)
      this.factories.set(key, f)
    }
    return f
  }

  get topLeft(): ComponentFactory {
    return this.at(OriginX.Left, OriginY.Top)
  }
  get topRight(): ComponentFactory {
    return this.at(OriginX.Right, OriginY.Top)
  }
  get center(): ComponentFactory {
    return this.at(OriginX.Center, OriginY.Center)
  }
  get bottomCenter(): ComponentFactory {
    return this.at(OriginX.Center, OriginY.Bottom)
  }

  /** Fige et calcule le layout de tous les composants attachés. */
  commit(): void {
    this.root.initialize()
  }
}

export interface ButtonOpts {
  x?: number
  y?: number
  label: string
  size: number
  font: string
  color: number
  bg: number
  bgHover: number
  onClick: () => void
  padX?: number
  padY?: number
}

/**
 * Compose un bouton pixui (fond + libellé + zone cliquable) sous une fabrique
 * ancrée. Le fond change de teinte au survol/appui. À appeler AVANT Ui.commit().
 */
export function button(f: ComponentFactory, o: ButtonOpts): void {
  const padX = o.padX ?? 16
  const padY = o.padY ?? 8
  const x = o.x ?? 0
  const y = o.y ?? 0

  // Le libellé se dimensionne seul dès sa création : on lit sa taille ensuite.
  const label = f.bitmapText({
    font: o.font,
    size: o.size,
    text: o.label,
    tint: o.color,
    x,
    y,
    originX: OriginX.Center,
    originY: OriginY.Center,
  })
  const w = label.width + padX * 2
  const h = label.height + padY * 2

  const bg: Rectangle = f.rectangle({
    x,
    y,
    width: w,
    height: h,
    fillColor: o.bg,
    originX: OriginX.Center,
    originY: OriginY.Center,
  })
  // Le fond a été attaché après le libellé (donc au-dessus) : on remonte le
  // libellé pour qu'il reste visible.
  label.bringToTop()

  const hit = f.clickable({
    x,
    y,
    width: w,
    height: h,
    originX: OriginX.Center,
    originY: OriginY.Center,
    onClick: o.onClick,
    onUpdate: () => {
      bg.fillColor = hit.hovered || hit.pressed ? o.bgHover : o.bg
    },
  })
}
