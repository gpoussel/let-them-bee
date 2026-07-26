import Phaser from 'phaser'
import { STR, UPGRADE_STR } from '../config/strings'
import {
  COMB,
  COMB_TOTAL,
  costLines,
  tierLabel,
  type CombCell,
  type Currency,
} from '../config/upgrades'
import { FONT_KEY } from '../gfx/font'
import { HEX_R, TEX } from '../gfx/textures'
import { audio } from '../systems/Audio'
import { gameState } from '../systems/GameState'
import { handCursor, wireHandCursors } from '../ui/cursor'
import { fmtBig } from '../ui/format'
import { button, ninePanel, OriginX, OriginY, Ui, UI9, type ButtonHandle } from '../ui/pixui'
import { pixelText } from '../ui/text'
import { COLORS, FONTS, HEX, PALETTE, PANEL_PAD, PANEL_TINT, SCREEN } from '../ui/theme'
import { wrap } from '../ui/tooltip'

// LE RAYON — l'écran d'améliorations.
//
// Ce n'est PAS une pop-up posée par-dessus le jeu : le rayon prend la place des
// quatre cadres du bas (effectifs, accès, pré, bandeau) et se présente comme un
// cadre de plus, du même bois qu'eux. Regarder sa ruche est une activité du jeu,
// pas une parenthèse — la fenêtre ne s'interrompt pas, elle change de contenu.
//
// C'est quand même une SCÈNE et non un panneau de la GameScene, pour trois
// raisons :
//   - elle couvre le HUD et les textes flottants sans avoir à surenchérir sur
//     les profondeurs (un « +3 » qui traversait la pop-up venait de là) ;
//   - le rayon se déplace et se met à l'échelle, ce que le layout pixui — posé
//     en coordonnées absolues du monde — ne sait pas faire ;
//   - le pré continue de tourner dessous : la ruche ne s'arrête pas parce qu'on
//     la regarde. Seules ses entrées sont coupées, pour que le glissé du rayon
//     ne pilote pas l'abeille en même temps.

/**
 * Emprise du rayon : l'union EXACTE des quatre cadres du bas de l'écran de jeu.
 * Elle est calculée à partir d'eux plutôt que recopiée en dur, pour qu'un
 * remaniement de la découpe (cf. `SCREEN`) l'emmène avec lui.
 */
const VIEW = {
  x: SCREEN.colony.x,
  y: SCREEN.colony.y,
  w: SCREEN.field.x + SCREEN.field.w - SCREEN.colony.x,
  h: SCREEN.status.y + SCREEN.status.h - SCREEN.colony.y,
} as const

/** Intérieur utile du cadre : ce qui reste une fois le nine-slice déduit. */
const INNER = {
  x: VIEW.x + PANEL_PAD,
  y: VIEW.y + PANEL_PAD,
  w: VIEW.w - PANEL_PAD * 2,
  h: VIEW.h - PANEL_PAD * 2,
} as const

/** Hauteur réservée en haut du cadre au titre et à la jauge. */
const HEADER_H = 40

/**
 * COLONNE DE DÉTAIL — à DROITE des alvéoles, et non plus sous elles.
 *
 * En bas, le détail n'avait qu'une ligne : les infobulles les plus utiles (les
 * ouvrières, l'économie) y tenaient sur 76 colonnes ou pas du tout, et une
 * seconde ligne aurait mangé la fenêtre du rayon sur toute sa largeur. Sur le
 * côté, elle mange une bande étroite et rend six lignes en échange — le texte
 * respire, et la hauteur gagnée en bas revient aux alvéoles.
 */
const SIDE_W = 246
/** Blanc entre la fenêtre des alvéoles et la colonne de détail. */
const SIDE_GAP = 12
/**
 * Largeur du détail en CARACTÈRES. La police est à chasse fixe : une cellule
 * fait la moitié de la taille du texte, donc `SIDE_W / (sizeHint / 2)`, moins
 * une colonne pour ne pas coller au liseré.
 */
const SIDE_COLS = Math.floor(SIDE_W / (FONTS.sizeHint / 2)) - 1

/** Écart entre deux centres d'alvéoles voisines (hexagones pointe en haut). */
const STEP_X = HEX_R * Math.sqrt(3)
const STEP_Y = HEX_R * 1.5

/** Opacité du texte d'une alvéole hors de prix : en retrait, mais lisible. */
const DIM_ALPHA = 0.65

/** Au-delà de ce déplacement, un clic est un glissé et n'achète rien. */
const DRAG_SLOP = 8

/**
 * Air qu'on peut dégager autour de l'alvéole la plus éloignée, en pixels.
 *
 * Sans elle, le glissé s'arrête pile quand le bord du rayon touche le bord du
 * cadre : la dernière alvéole reste collée au liseré, et on ne sait pas si on
 * est au bout du rayon ou au bout de la course. Une demi-alvéole de blanc suffit
 * à dire « c'est fini ».
 */
const PAN_MARGIN = 24

/** Côté de la vignette de monnaie (icône de la barre, bakée au point d'art). */
const COIN = 16
/** Blanc entre la vignette et le chiffre. */
const COIN_GAP = 3
/**
 * Interligne des deux prix d'une alvéole MIXTE, dans l'hexagone.
 *
 * Un prix mixte tient sur deux lignes et rien d'autre ne peut le dire : il n'y a
 * pas de monnaie commune où les additionner, et « 12k + 3k » ne voudrait rien
 * dire. Deux lignes serrées, chacune avec sa vignette — c'est plus dense qu'une
 * alvéole ordinaire, et c'est précisément le signal : ces alvéoles-là demandent
 * les deux moitiés du jeu.
 */
const COST_LINE_H = 13
/** Nombre maximal de lignes de prix : deux monnaies, pas plus (cf. `Cost`). */
const COST_LINES = 2

/**
 * Monnaie d'une alvéole, reprise TELLE QUELLE de la barre de ressources :
 * même dessin, même teinte. Le joueur n'a pas à apprendre un second code — la
 * goutte verte du haut de l'écran est la goutte verte du prix.
 */
const COIN_TEX: Record<Currency, string> = {
  nectar: TEX.iconNectarSmall,
  honey: TEX.iconHoneySmall,
}
const COIN_TINT: Record<Currency, number> = {
  nectar: PALETTE.lime,
  honey: PALETTE.amber,
}

/** Une ligne de prix : sa vignette et son chiffre, recentrés ensemble. */
interface CostRow {
  coin: Phaser.GameObjects.Image
  text: Phaser.GameObjects.BitmapText
}

interface CellView {
  cell: CombCell
  root: Phaser.GameObjects.Container
  hex: Phaser.GameObjects.Image
  name: Phaser.GameObjects.BitmapText
  /** Une ligne par monnaie demandée ; la seconde reste cachée pour un prix simple. */
  rows: CostRow[]
  /** Le mot « Built », à la place des prix, une fois l'alvéole bâtie. */
  built: Phaser.GameObjects.BitmapText
}

export class CombScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container
  private views: CellView[] = []
  private detail!: Phaser.GameObjects.BitmapText
  private detailName!: Phaser.GameObjects.BitmapText
  /** Les deux lignes de prix de la colonne de détail (cf. `buildChrome`). */
  private detailCost!: CostRow[]
  private progress!: Phaser.GameObjects.BitmapText
  /** Achat groupé, légué par la lignée (`busyWax`) : absent sans elle. */
  private buyAll!: ButtonHandle
  private hovered: CombCell | null = null
  private dragged = false

  constructor() {
    super('Comb')
  }

  create(): void {
    // Phaser réutilise l'INSTANCE de scène d'une ouverture à l'autre : sans ce
    // remise à zéro, on garderait les alvéoles de la fois précédente, détruites
    // avec leur scène, et le premier rafraîchissement planterait dessus.
    this.views = []
    this.hovered = null
    this.dragged = false

    const view = this.hiveView()

    // Le cadre du rayon, dessiné AVANT le calque : même nine-slice et même
    // teinte que les cadres qu'il remplace. La barre de ressources reste
    // découverte au-dessus — le joueur doit voir sa réserve fondre à l'achat.
    const frame = new Ui(this)
    ninePanel(frame.topLeft, {
      originX: OriginX.Left,
      originY: OriginY.Top,
      x: VIEW.x,
      y: VIEW.y,
      width: VIEW.w,
      height: VIEW.h,
      skin: UI9.insetDark,
      tint: PANEL_TINT,
    })
    frame.commit()

    // Fond sombre de la seule zone des alvéoles : le pré qui continue de tourner
    // dessous ne doit pas transparaître entre les hexagones.
    this.add.rectangle(view.x, view.y, view.w, view.h, COLORS.bgDark).setOrigin(0, 0).setAlpha(1)

    this.layer = this.add.container(view.x + view.w / 2, view.y + view.h / 2)

    this.buildHive()
    for (const cell of COMB) this.views.push(this.buildCell(cell))

    this.buildChrome()
    this.clipToView()
    this.clampPan()
    this.wireInput()
    wireHandCursors(this)
    this.refresh()
  }

  // --- Construction --------------------------------------------------------

  /**
   * Encombrement du rayon entier, à l'échelle 1, hexagones compris, en
   * coordonnées locales au calque (la ruche est en 0, 0).
   *
   * Les bornes sont relevées des QUATRE côtés séparément, et non ramenées à un
   * demi-encombrement symétrique : la branche « réserve » monte cinquante
   * alvéoles au-dessus de la ruche et rien ne descend autant. Un encombrement
   * symétrique aurait autorisé à faire glisser vers le bas autant de vide qu'il y
   * a de cire en haut.
   */
  private extent(): { minX: number; maxX: number; minY: number; maxY: number } {
    const box = { minX: -HEX_R, maxX: HEX_R, minY: -HEX_R, maxY: HEX_R }
    for (const cell of COMB) {
      const { x, y } = this.posOf(cell.q, cell.r)
      box.minX = Math.min(box.minX, x - HEX_R)
      box.maxX = Math.max(box.maxX, x + HEX_R)
      box.minY = Math.min(box.minY, y - HEX_R)
      box.maxY = Math.max(box.maxY, y + HEX_R)
    }
    return box
  }

  /**
   * Découpe la fenêtre des alvéoles avec une caméra dédiée.
   *
   * Un masque aurait été plus direct, mais en Phaser 4 les masques ne vivent
   * plus que sur les caméras : `Container.setMask` existe (le mixin est là) et
   * ne fait rien, le rendu du conteneur ne le lit jamais. Une caméra, elle,
   * découpe par son propre viewport — c'est un ciseau matériel, gratuit.
   *
   * Le survol et le clic y survivent : le test de pointage passe en revue
   * TOUTES les caméras sous le pointeur, de la plus haute à la plus basse, et
   * respecte leurs listes d'ignorés. La caméra du rayon est au-dessus et ne voit
   * que le calque ; la principale voit tout le reste (cadre, titre, bouton de
   * fermeture) et ignore le calque. Chaque objet a donc exactement une caméra
   * qui le dessine et le pointe.
   */
  private clipToView(): void {
    const view = this.hiveView()

    // Tout ce qui est déjà posé sauf le calque : c'est le décor fixe, et il
    // reste à la caméra principale. Rien n'est créé après ce point.
    const chrome = this.children.list.filter((o) => o !== this.layer)

    this.cameras.main.ignore(this.layer)
    const clip = this.cameras.add(view.x, view.y, view.w, view.h)
    // Le viewport est décalé dans l'écran : sans ce défilement, la caméra
    // afficherait le monde à partir de (0, 0) dans le coin de la fenêtre et le
    // rayon partirait en biais. Ce calage aligne les deux caméras au pixel.
    clip.setScroll(view.x, view.y)
    clip.ignore(chrome)
  }

  /**
   * Recale le rayon dans sa fenêtre, en lui laissant `PAN_MARGIN` d'air autour
   * de son alvéole la plus éloignée.
   *
   * Plus grand que sa fenêtre sur un axe, le rayon glisse le long de cet axe ;
   * plus petit, il y reste centré — la marge ne sert qu'à respirer au bout de la
   * course, pas à faire flotter un rayon qui tient déjà tout entier.
   */
  private clampPan(): void {
    const view = this.hiveView()
    const box = this.extent()
    this.layer.x = this.axis(this.layer.x, box.minX, box.maxX, view.x, view.w)
    this.layer.y = this.axis(this.layer.y, box.minY, box.maxY, view.y, view.h)
  }

  /**
   * Position du calque sur un axe : recalée dans la course s'il y a débord,
   * centrée sur le contenu s'il n'y en a pas.
   *
   * @param lo bord bas du contenu, local au calque ; `hi` son bord haut.
   * @param origin bord bas de la fenêtre à l'écran ; `size` sa taille.
   */
  private axis(pos: number, lo: number, hi: number, origin: number, size: number): number {
    if (hi - lo <= size) return origin + size / 2 - (lo + hi) / 2
    // Le contenu déborde : on borne la course pour que le bord de la cire ne
    // rentre jamais plus loin que `PAN_MARGIN` dans la fenêtre.
    const min = origin + size - hi - PAN_MARGIN
    const max = origin - lo + PAN_MARGIN
    return Phaser.Math.Clamp(pos, min, max)
  }

  /** Fenêtre où vivent les alvéoles : l'intérieur du cadre, titre et détail ôtés. */
  private hiveView(): { x: number; y: number; w: number; h: number } {
    return {
      x: INNER.x,
      y: INNER.y + HEADER_H,
      w: INNER.w - SIDE_W - SIDE_GAP,
      h: INNER.h - HEADER_H,
    }
  }

  /** Position à l'écran (locale au calque) d'une alvéole axiale. */
  private posOf(q: number, r: number): { x: number; y: number } {
    return { x: STEP_X * (q + r / 2), y: STEP_Y * r }
  }

  /** L'alvéole centrale : la ruche. Elle ne s'achète pas, tout part d'elle. */
  private buildHive(): void {
    const hive = this.add.container(0, 0)
    hive.add(this.add.image(0, 0, TEX.hexDone))
    hive.add(this.add.image(0, 0, TEX.hive))
    this.layer.add(hive)
  }

  private buildCell(cell: CombCell): CellView {
    const { x, y } = this.posOf(cell.q, cell.r)
    const root = this.add.container(x, y)

    const hex = this.add.image(0, 0, TEX.hexIdle)
    hex.setInteractive({ useHandCursor: false })
    handCursor(hex)
    hex.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => (this.hovered = cell))
    hex.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      if (this.hovered === cell) this.hovered = null
    })
    hex.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (p: Phaser.Input.Pointer) => {
      this.tryBuy(cell, p)
    })

    const label = UPGRADE_STR[cell.kind].name
    const tier = tierLabel(cell)
    // Le rang passe à la ligne : « Storage III » d'un seul tenant déborde d'une
    // alvéole et vient mordre sur ses voisines.
    const lines = costLines(cell.cost)
    const name = pixelText(
      this,
      0,
      // Le nom remonte d'un cran quand le prix prend deux lignes, pour que les
      // deux tiennent dans l'hexagone sans se toucher.
      lines.length > 1 ? -17 : -12,
      tier ? `${label}\n${tier}` : label,
      FONTS.sizeHint,
      HEX.cream,
    )
      .setOrigin(0.5, 0.5)
      .setCenterAlign()

    // Prix = vignette + chiffre, recentrés ensemble à chaque rafraîchissement
    // (la largeur du chiffre change avec sa valeur). Les deux lignes sont
    // fabriquées TOUTES LES DEUX, même pour un prix simple : le rayon se
    // rafraîchit à chaque frame, et créer un objet Phaser en cours de route
    // coûterait plus cher que d'en cacher un.
    const rows: CostRow[] = []
    const top = 19 - ((lines.length - 1) * COST_LINE_H) / 2
    for (let i = 0; i < COST_LINES; i++) {
      const line = lines[i] as { currency: Currency; amount: number } | undefined
      const currency: Currency = line?.currency ?? 'nectar'
      const y = top + i * COST_LINE_H
      rows.push({
        coin: this.add
          .image(0, y, COIN_TEX[currency])
          .setOrigin(0.5, 0.5)
          .setTint(COIN_TINT[currency]),
        text: pixelText(this, 0, y, '', FONTS.sizeHint, HEX.cream).setOrigin(0, 0.5),
      })
    }

    // « Built » prend la place des prix : pas de vignette, un mot centré.
    const built = pixelText(this, 0, 19, STR.combOwned, FONTS.sizeHint, HEX.cream)
      .setOrigin(0.5, 0.5)
      .setTint(PALETTE.lime)
      .setVisible(false)

    root.add([hex, name, ...rows.flatMap((r) => [r.coin, r.text]), built])
    this.layer.add(root)
    return { cell, root, hex, name, rows, built }
  }

  /** Titre, jauge, ligne de détail et bouton de fermeture — posés en pixui, fixes. */
  private buildChrome(): void {
    const ui = new Ui(this)
    const f = ui.topLeft
    const anchor = { originX: OriginX.Left, originY: OriginY.Top } as const

    f.bitmapText({
      ...anchor,
      font: FONT_KEY,
      size: FONTS.sizeSmall,
      text: STR.comb,
      tint: PALETTE.amber,
      x: INNER.x,
      y: INNER.y,
    })

    // Achat groupé. Il ne s'affiche QUE si la lignée l'a légué (cf. `refresh`) :
    // sans elle, bâtir le rayon alvéole par alvéole EST le geste du jeu, et un
    // bouton grisé en permanence ne ferait qu'annoncer ce qui manque.
    this.buyAll = button(f, {
      font: FONT_KEY,
      size: FONTS.sizeHint,
      label: STR.buyAll,
      color: COLORS.darkBrown,
      padX: 14,
      padY: 6,
      x: INNER.x + 200,
      y: INNER.y + 8,
      onClick: () => {
        if (gameState.buyAllAffordable() > 0) this.refresh()
      },
    })

    button(ui.topRight, {
      font: FONT_KEY,
      size: FONTS.sizeHint,
      label: STR.close,
      color: COLORS.darkBrown,
      padX: 14,
      padY: 6,
      // Calé dans l'angle : ces deux nombres sont relevés sur les bornes RÉELLES
      // du bouton rendu (`getBounds`), pas déduites de sa position déclarée — la
      // fabrique `topRight` et le nine-slice décalent l'un et l'autre le dessin,
      // et viser à la main laissait le bouton flotter loin du liseré.
      x: -53,
      y: INNER.y + 8,
      onClick: () => {
        this.close()
      },
    })

    ui.commit()

    // Jauge et détail restent hors pixui : leur texte change à chaque frame, et
    // le ratchet de largeur des BitmapText pixui coûte plus qu'il ne rapporte
    // pour deux lignes posées à la main.
    this.progress = pixelText(this, INNER.x, INNER.y + 24, '', FONTS.sizeHint, HEX.cream).setOrigin(
      0,
      0,
    )
    // La colonne de détail : le nom de l'alvéole survolée, puis ce qu'elle fait.
    // Les deux textes partent du haut de la colonne — un texte de six lignes qui
    // grandirait vers le haut ferait sauter son titre à chaque survol.
    const side = this.hiveView()
    const sideX = side.x + side.w + SIDE_GAP
    this.detailName = pixelText(this, sideX, side.y, '', FONTS.sizeHint, HEX.cream)
      .setOrigin(0, 0)
      .setTint(PALETTE.amber)
    this.detail = pixelText(
      this,
      sideX,
      side.y + FONTS.sizeHint + 6,
      '',
      FONTS.sizeHint,
      HEX.cream,
    ).setOrigin(0, 0)

    // LE PRIX, EN TOUTES LETTRES, sous l'infobulle. L'hexagone dit déjà le prix,
    // mais serré et abrégé ; ici il a la place de dire aussi ce qu'il MANQUE, et
    // surtout de tenir deux lignes sans se tasser. C'est là que se lit un prix
    // mixte : une ligne nectar, une ligne miel, chacune avec son icône, et
    // chacune de la couleur de son verdict.
    this.detailCost = []
    for (let i = 0; i < COST_LINES; i++) {
      const y = side.y + (FONTS.sizeHint + 4) * (i + 1)
      this.detailCost.push({
        coin: this.add.image(sideX + COIN / 2, y, TEX.iconNectarSmall).setOrigin(0.5, 0.5),
        text: pixelText(this, sideX + COIN + COIN_GAP, y, '', FONTS.sizeHint, HEX.cream).setOrigin(
          0,
          0.5,
        ),
      })
    }
  }

  // --- Entrées -------------------------------------------------------------

  private wireInput(): void {
    // Le pré tourne toujours, mais il ne doit plus écouter la souris : sans ça,
    // glisser le rayon ferait voler l'abeille en aveugle derrière le voile.
    this.setGameInput(false)

    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.dragged = false
    })

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return
      // Le rayon n'est plus plein écran : glisser hors de son cadre (sur la
      // barre de ressources, par exemple) ne doit pas le déplacer.
      if (!this.inView(p)) return
      if (this.travel(p) > DRAG_SLOP) this.dragged = true
      this.pan(p.x - p.prevPosition.x, p.y - p.prevPosition.y)
    })

    // Pas de zoom : le rayon reste à l'échelle 1. Toute autre échelle tombe sur
    // des demi-pixels, et la police bitmap comme le liseré des alvéoles s'y
    // déforment. Le rayon est dimensionné (cf. `HEX_R`) pour tenir tel quel dans
    // sa fenêtre ; s'il finit par la déborder, c'est le glissé qui y mène.

    this.input.keyboard?.on('keydown-ESC', () => {
      this.close()
    })
  }

  /**
   * Distance parcourue depuis l'appui. Lue sur le pointeur lui-même (`downX`)
   * plutôt que sur une position relevée à la main : le relevé manquait quand
   * l'appui n'avait pas été vu par cette scène, et le clic partait alors avec
   * une distance absurde — donc refusé.
   */
  private travel(p: Phaser.Input.Pointer): number {
    return Math.abs(p.x - p.downX) + Math.abs(p.y - p.downY)
  }

  /** Le pointeur est-il dans la fenêtre des alvéoles ? */
  private inView(p: Phaser.Input.Pointer): boolean {
    const v = this.hiveView()
    return p.x >= v.x && p.x <= v.x + v.w && p.y >= v.y && p.y <= v.y + v.h
  }

  private pan(dx: number, dy: number): void {
    this.layer.x += dx
    this.layer.y += dy
    this.clampPan()
  }

  private tryBuy(cell: CombCell, p: Phaser.Input.Pointer): void {
    // La distance est recontrôlée ICI, au relâché, en plus du drapeau posé au
    // déplacement : selon la frame, Phaser peut traiter le relâché avant le
    // mouvement qui l'a précédé, et un glissé du rayon achetait alors l'alvéole
    // sous le doigt.
    if (this.travel(p) > DRAG_SLOP) return
    if (this.dragged) return
    if (!gameState.canBuy(cell)) return
    gameState.buyCell(cell)
    audio.playClick()
    this.refresh()
  }

  private close(): void {
    // Rendre la main au pré une frame PLUS TARD : les deux scènes écoutent Échap
    // et traitent la même touche dans la même frame. Réactiver tout de suite, et
    // la touche qui ferme le rayon ouvrait aussi le menu de pause derrière.
    const game = this.scene.get('Game')
    if (game)
      game.time.delayedCall(0, () => {
        this.setGameInput(true)
      })
    this.scene.stop()
  }

  /**
   * Souris ET clavier du pré. La souris, parce qu'un glissé du rayon ferait
   * sinon voler l'abeille en aveugle ; le clavier, parce que les deux scènes
   * écoutent Échap et que c'est au rayon de le prendre tant qu'il est ouvert.
   */
  private setGameInput(on: boolean): void {
    const game = this.scene.get('Game')
    if (!game) return
    game.input.enabled = on
    if (game.input.keyboard) game.input.keyboard.enabled = on
  }

  // --- Rendu ---------------------------------------------------------------

  update(): void {
    this.refresh()
  }

  private refresh(): void {
    for (const view of this.views) {
      const { cell } = view
      // Une alvéole non dévoilée n'est pas grisée : elle N'EXISTE PAS encore.
      // Le rayon doit donner l'impression d'une ruche qu'on agrandit, pas d'un
      // catalogue dont on connaîtrait déjà la dernière page.
      const revealed = gameState.isRevealed(cell)
      view.root.visible = revealed
      // Phaser n'interroge pas les objets invisibles, mais l'achat repasse de
      // toute façon par `canBuy` : une alvéole non dévoilée ne s'achète pas.
      if (view.hex.input) view.hex.input.enabled = revealed
      if (!revealed) continue

      const owned = gameState.owns(cell)
      const affordable = !owned && gameState.canAfford(cell)

      // Les trois états demandés, et rien de plus : bâtie / payable / trop
      // chère. La texture porte l'état, le prix le confirme.
      view.hex.setTexture(owned ? TEX.hexDone : affordable ? TEX.hexReady : TEX.hexIdle)
      // Une alvéole hors de prix s'éteint par l'ALPHA, pas par la couleur : le
      // brun olive de la palette sur le vert-gris de la texture « trop chère »
      // ne se lisait plus du tout, et un prix qu'on ne peut pas payer reste ce
      // qu'il faut lire pour savoir quoi viser. Le crème atténué le dit sans
      // rendre l'alvéole aussi vive que celles qui sont à portée.
      const dim = owned || affordable ? 1 : DIM_ALPHA
      view.name.setTint(COLORS.cream)
      view.name.setAlpha(dim)

      // Une alvéole bâtie n'a plus de prix : ses lignes s'effacent, le mot les
      // remplace au centre.
      view.built.setVisible(owned)
      const lines = costLines(cell.cost)
      view.rows.forEach((row, i) => {
        const line = lines[i] as { currency: Currency; amount: number } | undefined
        const show = !owned && line !== undefined
        row.coin.setVisible(show)
        row.text.setVisible(show)
        if (!show || !line) return
        // Le prix s'abrège au-delà de cinq chiffres : les alvéoles de fin de
        // partie en coûtent six ou sept, qui débordaient de l'hexagone sur ses
        // voisines.
        row.text.setText(fmtBig(line.amount))
        // Chaque ligne s'éteint SÉPARÉMENT. Sur un prix mixte, c'est la seule
        // information qui compte : le joueur doit voir LAQUELLE des deux
        // monnaies lui manque, pas seulement que l'alvéole est hors d'atteinte.
        const rowDim = gameState[line.currency] >= line.amount ? 1 : DIM_ALPHA
        row.text.setTint(COLORS.cream)
        row.text.setAlpha(rowDim)
        row.coin.setAlpha(rowDim)
        const total = COIN + COIN_GAP + row.text.width
        row.coin.x = -total / 2 + COIN / 2
        row.text.x = -total / 2 + COIN + COIN_GAP
      })
    }

    this.progress.setText(`${gameState.comb.size}/${COMB_TOTAL}`)
    // Il disparaît quand il n'a plus rien à bâtir : un bouton qui ne peut rien
    // faire n'a pas à occuper le haut du rayon.
    this.buyAll.visible = gameState.canBulkBuy && gameState.combHasOffer
    // Rien sous le rayon quand rien n'est survolé : la ligne ne sert qu'à dire
    // ce que fait l'alvéole visée, et une consigne permanente n'y avait pas sa
    // place.
    const hovered = this.hovered
    const tier = hovered ? tierLabel(hovered) : ''
    this.detailName.setText(
      hovered ? `${UPGRADE_STR[hovered.kind].name}${tier ? ` ${tier}` : ''}` : '',
    )

    // Le prix s'intercale entre le nom et l'infobulle, et l'infobulle descend de
    // ce qu'il occupe : une ligne pour un prix simple, deux pour un prix mixte.
    // C'est ce qui permet à la colonne de dire un prix mixte sans jamais pousser
    // le texte hors du cadre.
    const owned = hovered ? gameState.owns(hovered) : false
    const lines = hovered && !owned ? costLines(hovered.cost) : []
    this.detailCost.forEach((row, i) => {
      const line = lines[i] as { currency: Currency; amount: number } | undefined
      row.coin.setVisible(line !== undefined)
      row.text.setVisible(line !== undefined)
      if (!line) return
      row.coin.setTexture(COIN_TEX[line.currency]).setTint(COIN_TINT[line.currency])
      row.text.setText(fmtBig(line.amount))
      // Vert quand la bourse suffit, ambre quand elle ne suffit pas : sur un prix
      // mixte, c'est la seule façon de voir laquelle des deux monnaies bloque.
      row.text.setTint(gameState[line.currency] >= line.amount ? PALETTE.lime : PALETTE.amber)
    })

    const side = this.hiveView()
    this.detail.y = side.y + (FONTS.sizeHint + 4) * (lines.length + 1) + 4
    this.detail.setText(hovered ? wrap(UPGRADE_STR[hovered.kind].tip, SIDE_COLS) : '')
  }
}
