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
import { Container, ComponentFactory, Image, OriginX, OriginY } from 'phaser-pixui'
import type { ComponentConfig } from 'phaser-pixui'
import { WORLD } from '../config/game'
import { TEX } from '../gfx/textures'
import { UI9, UI9_MIN, type Ui9Skin } from '../gfx/ui9'
import { handCursor, wireHandCursors } from './cursor'

export { OriginX, OriginY }
export { handCursor }
export { UI9, type Ui9Skin }

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
/** Conteneur pixui exposant une fabrique mémoïsée par coin d'ancrage. */
class Anchored {
  private readonly factories = new Map<string, ComponentFactory>()

  constructor(
    protected readonly scene: Phaser.Scene,
    readonly container: Container,
  ) {}

  /** Fabrique liée à un coin d'ancrage donné (mémoïsée). */
  at(originX: OriginX, originY: OriginY): ComponentFactory {
    const key = `${originX}:${originY}`
    let f = this.factories.get(key)
    if (!f) {
      f = new ComponentFactory({ scene: this.scene, originX, originY })
      f.setContainer(this.container)
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
  get bottomLeft(): ComponentFactory {
    return this.at(OriginX.Left, OriginY.Bottom)
  }
  get bottomRight(): ComponentFactory {
    return this.at(OriginX.Right, OriginY.Bottom)
  }
  get bottomCenter(): ComponentFactory {
    return this.at(OriginX.Center, OriginY.Bottom)
  }
}

/**
 * Sous-conteneur (ex. une modale) que l'on peut masquer/afficher d'un bloc et
 * remonter au premier plan. Ses composants s'ancrent sur SES propres bords.
 */
export class Panel extends Anchored {
  get visible(): boolean {
    return this.container.visible
  }
  set visible(value: boolean) {
    this.container.visible = value
  }

  /** Remonte tous les objets du panel au-dessus du reste de la display list. */
  bringToTop(): void {
    this.container.bringToTop()
  }
}

/**
 * Racine de layout pixui pour une scène. Ordre d'usage :
 *   const ui = new Ui(scene)
 *   ui.topLeft.bitmapText({ ... })   // on attache les composants…
 *   ui.commit()                      // …puis on fige le layout (une fois)
 * Après commit(), toute mutation (text, fillColor, setWidth…) repositionne
 * automatiquement le composant concerné.
 */
export class Ui extends Anchored {
  constructor(scene: Phaser.Scene) {
    const root = new Container(scene)
    // On mémorise l'ancre plein écran ; le layout effectif aura lieu au commit().
    root.reposition(
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
    super(scene, root)
    wireHandCursors(scene)
  }

  get root(): Container {
    return this.container
  }

  /** Crée un sous-conteneur ancré dans la racine (voir {@link Panel}). */
  panel(cfg: ComponentConfig): Panel {
    const child = new Container(this.scene, cfg)
    this.container.attach(child, cfg.originX ?? OriginX.Center, cfg.originY ?? OriginY.Center)
    return new Panel(this.scene, child)
  }

  /** Fige et calcule le layout de tous les composants attachés. */
  commit(): void {
    this.container.initialize()
  }
}

export interface IconButtonOpts {
  x?: number
  y?: number
  texture: string
  /** Teinte appliquée au survol (aucune teinte au repos). */
  tintHover?: number
  originX?: OriginX
  originY?: OriginY
  onClick: () => void
}

/**
 * Icône cliquable (texture affichée à sa taille native + zone de clic de même
 * dimension). À appeler AVANT Ui.commit().
 */
export function iconButton(f: ComponentFactory, o: IconButtonOpts): Image {
  const x = o.x ?? 0
  const y = o.y ?? 0
  const originX = o.originX ?? OriginX.Center
  const originY = o.originY ?? OriginY.Center

  // La taille de la zone de clic est lue sur la texture : les composants pixui
  // ne connaissent leurs dimensions absolues qu'après commit().
  const frame = f.scene.textures.getFrame(o.texture, '__BASE')
  const img = f.image({ texture: o.texture, frame: '__BASE', x, y, originX, originY })
  const hit = f.clickable({
    x,
    y,
    width: frame.width,
    height: frame.height,
    originX,
    originY,
    onClick: o.onClick,
    onUpdate: () => {
      img.tint = hit.hovered || hit.pressed ? (o.tintHover ?? 0xffffff) : undefined
    },
  })
  handCursor(hit.events)
  return img
}

export interface NinePanelOpts {
  x?: number
  y?: number
  width: number
  height: number
  /** Tuile du tileset d'interface (défaut : cadre brun à liseré). */
  skin?: Ui9Skin
  originX?: OriginX
  originY?: OriginY
}

/**
 * Cadre nine-slice du tileset d'interface, redimensionnable à volonté (les
 * coins de 16 px restent intacts). Générique : à utiliser pour toute pop-up,
 * encart ou fond de panneau. À appeler AVANT Ui.commit().
 */
export function ninePanel(f: ComponentFactory, o: NinePanelOpts): Image {
  return f.image({
    texture: TEX.ui,
    frame: o.skin ?? UI9.insetDark,
    x: o.x ?? 0,
    y: o.y ?? 0,
    width: Math.max(UI9_MIN, o.width),
    height: Math.max(UI9_MIN, o.height),
    originX: o.originX ?? OriginX.Center,
    originY: o.originY ?? OriginY.Center,
  })
}

export interface ButtonOpts {
  x?: number
  y?: number
  label: string
  size: number
  font: string
  /** Couleur du libellé. */
  color: number
  /** Tuiles au repos / au survol (défaut : ambre → clair). */
  skin?: Ui9Skin
  skinHover?: Ui9Skin
  onClick: () => void
  padX?: number
  padY?: number
  /** Largeur imposée (sinon : libellé + marges). Utile pour aligner un menu. */
  width?: number
}

// Le tileset dessine une ombre portée sur ses 3 dernières lignes : le libellé
// est remonté d'autant pour rester centré dans la face visible du bouton.
const BUTTON_SHADOW = 3

/**
 * Bouton texte sur fond nine-slice (fond + libellé + zone cliquable), sous une
 * fabrique ancrée. Le fond change de tuile au survol/appui. Générique : aucune
 * dépendance à une scène particulière. À appeler AVANT Ui.commit().
 */
export function button(f: ComponentFactory, o: ButtonOpts): void {
  const padX = o.padX ?? 20
  const padY = o.padY ?? 10
  const x = o.x ?? 0
  const y = o.y ?? 0
  const skin = o.skin ?? UI9.insetAmber
  const skinHover = o.skinHover ?? UI9.insetLight

  // Le libellé est mesuré d'abord (sa taille dépend de la fonte), mais le fond
  // doit rester SOUS lui dans la display list : on le crée juste avant, à une
  // taille provisoire, puis on l'ajuste.
  const measure = f.scene.make.bitmapText({ font: o.font, size: o.size, text: o.label }, false)
  const w = o.width ?? Math.max(UI9_MIN, measure.width + padX * 2)
  const h = Math.max(UI9_MIN, measure.height + padY * 2 + BUTTON_SHADOW)
  measure.destroy()

  // Les deux états sont deux cadres superposés dont on bascule la visibilité :
  // changer la frame d'un nine-slice en place réinitialise ses dimensions.
  const bg = ninePanel(f, { x, y, width: w, height: h, skin })
  const bgHover = ninePanel(f, { x, y, width: w, height: h, skin: skinHover })
  bgHover.visible = false
  f.bitmapText({
    font: o.font,
    size: o.size,
    text: o.label,
    tint: o.color,
    x,
    y: y - BUTTON_SHADOW,
    originX: OriginX.Center,
    originY: OriginY.Center,
  })

  const hit = f.clickable({
    x,
    y,
    width: w,
    height: h,
    originX: OriginX.Center,
    originY: OriginY.Center,
    onClick: o.onClick,
    onUpdate: () => {
      const hover = hit.hovered || hit.pressed
      bg.visible = !hover
      bgHover.visible = hover
    },
  })
  handCursor(hit.events)
}
