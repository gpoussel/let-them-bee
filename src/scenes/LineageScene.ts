import Phaser from 'phaser'
import { LINEAGE, LINEAGE_TOTAL, lineageTierLabel, type LineageNode } from '../config/lineage'
import { LINEAGE_STR, STR } from '../config/strings'
import { FONT_KEY } from '../gfx/font'
import { HEX_R, TEX } from '../gfx/textures'
import { gameState } from '../systems/GameState'
import { handCursor, wireHandCursors } from '../ui/cursor'
import { fmtFine } from '../ui/format'
import {
  button,
  ninePanel,
  OriginX,
  OriginY,
  setText,
  Ui,
  UI9,
  type ButtonHandle,
} from '../ui/pixui'
import { pixelText } from '../ui/text'
import { COLORS, FONTS, HEX, PALETTE, PANEL_PAD, PANEL_TINT, SCREEN } from '../ui/theme'
import { wrap } from '../ui/tooltip'

// LA LIGNÉE DE LA REINE — l'écran de prestige.
//
// Il se lit À TOUT MOMENT et ne se dépense qu'une fois la ruche quittée. C'est
// tout le propos : le joueur doit pouvoir voir ce qu'il vise AVANT de sacrifier
// sa colonie, sinon l'essaimage est un saut dans le noir. Ouvert sans avoir
// essaimé, l'arbre est donc un plan, pas une boutique — les nœuds s'y survolent,
// s'y lisent, et refusent de s'acheter.
//
// L'écran occupe la même emprise que le rayon (les quatre cadres du bas) et pour
// les mêmes raisons : la barre de ressources reste découverte au-dessus, on y
// voit la gelée royale fondre à chaque nœud, et le pré continue de tourner
// dessous, entrées coupées.
//
// L'arbre est POSÉ, pas glissable : neuf branches tiennent dans le cadre, et un
// plan qu'on ne peut pas embrasser d'un regard ne se planifie pas.

/** Emprise de l'écran : l'union exacte des quatre cadres du bas (cf. CombScene). */
const VIEW = {
  x: SCREEN.colony.x,
  y: SCREEN.colony.y,
  w: SCREEN.field.x + SCREEN.field.w - SCREEN.colony.x,
  h: SCREEN.status.y + SCREEN.status.h - SCREEN.colony.y,
} as const

const INNER = {
  x: VIEW.x + PANEL_PAD,
  y: VIEW.y + PANEL_PAD,
  w: VIEW.w - PANEL_PAD * 2,
  h: VIEW.h - PANEL_PAD * 2,
} as const

/**
 * Les neuf branches, dans l'ordre de la grille (trois colonnes, trois rangées) :
 * l'héritage du rayon en haut, le pré au milieu, le vol en bas. C'est l'ordre du
 * plus structurant au plus fin — et celui de `config/lineage`.
 */
const GRID: readonly string[] = [
  'nectarBlood',
  'honeyBlood',
  'busyWax',
  'wideMeadow',
  'richBloom',
  'quickRoots',
  'steadyWings',
  'longDays',
  'keenEye',
]
const COLS = 3

/** Pas horizontal entre deux paliers d'une même branche. */
const STEP_X = HEX_R * Math.sqrt(3)
/** Ligne du compteur de nœuds, sous le titre. */
const COUNT_Y = INNER.y + 28
/** Haut de la grille, sous le titre et le compteur — fond sombre compris. */
const GRID_Y = INNER.y + 52
/** Hauteur d'une rangée : le nom de la branche, puis ses paliers. */
const ROW_H = 94
/** Descente du centre des hexagones sous le nom de leur branche. */
const HEX_DROP = 46

/**
 * Le bas de l'écran, en coordonnées ABSOLUES, comme tout le reste de la scène.
 * Le bouton s'ancre en haut à gauche pour la même raison que la grille : ancré
 * en bas, son `y` compterait vers le BAS depuis le bord de l'écran et le bouton
 * sortirait du monde.
 */
const DETAIL_Y = GRID_Y + ROW_H * 3 + 8
/** Délai au bout duquel un essaimage armé se désamorce, en ms. */
const ARM_MS = 4000
const WARN_Y = DETAIL_Y + 50
const ACTION_Y = WARN_Y + 34

/** Côté de la vignette de gelée royale (icône de la barre, bakée au point d'art). */
const COIN = 16
const COIN_GAP = 3

/** Opacité d'un nœud hors d'atteinte : en retrait, mais lisible. */
const DIM_ALPHA = 0.65

interface NodeView {
  node: LineageNode
  root: Phaser.GameObjects.Container
  hex: Phaser.GameObjects.Image
  name: Phaser.GameObjects.BitmapText
  coin: Phaser.GameObjects.Image
  cost: Phaser.GameObjects.BitmapText
}

export class LineageScene extends Phaser.Scene {
  private views: NodeView[] = []
  private detailName!: Phaser.GameObjects.BitmapText
  private detail!: Phaser.GameObjects.BitmapText
  private progress!: Phaser.GameObjects.BitmapText
  /** La gelée qu'il reste à poser, et sa vignette. */
  private purse!: Phaser.GameObjects.BitmapText
  private purseCoin!: Phaser.GameObjects.Image
  private warning!: Phaser.GameObjects.BitmapText
  /** Le seul bouton de l'écran : essaimer. */
  private action!: ButtonHandle
  private hovered: LineageNode | null = null
  /**
   * L'essaimage est armé : le prochain clic part. Un geste aussi cher qu'une
   * colonie entière ne se déclenche pas sur un clic de travers, et une pop-up de
   * confirmation par-dessus l'arbre en cacherait justement l'enjeu.
   */
  private armed = false
  private armTimer: Phaser.Time.TimerEvent | null = null

  constructor() {
    super('Lineage')
  }

  create(): void {
    // Phaser réutilise l'INSTANCE de scène d'une ouverture à l'autre (cf.
    // CombScene) : sans cette remise à zéro on garderait les nœuds détruits avec
    // la scène précédente.
    this.views = []
    this.hovered = null

    const ui = new Ui(this)
    ninePanel(ui.topLeft, {
      originX: OriginX.Left,
      originY: OriginY.Top,
      x: VIEW.x,
      y: VIEW.y,
      width: VIEW.w,
      height: VIEW.h,
      skin: UI9.insetDark,
      tint: PANEL_TINT,
    })

    // Fond sombre sous la grille : le pré qui continue de tourner dessous ne
    // doit pas transparaître entre les hexagones.
    this.add.rectangle(INNER.x, GRID_Y - 6, INNER.w, ROW_H * 3 + 6, COLORS.bgDark).setOrigin(0, 0)

    this.buildChrome(ui)
    this.buildGrid()
    ui.commit()

    wireHandCursors(this)
    this.wireInput()
    this.refresh()
  }

  // --- Construction --------------------------------------------------------

  private buildChrome(ui: Ui): void {
    const f = ui.topLeft
    const anchor = { originX: OriginX.Left, originY: OriginY.Top } as const

    f.bitmapText({
      ...anchor,
      font: FONT_KEY,
      size: FONTS.sizeSmall,
      text: STR.lineage,
      tint: PALETTE.amber,
      x: INNER.x,
      y: INNER.y,
    })

    button(ui.topRight, {
      font: FONT_KEY,
      size: FONTS.sizeHint,
      label: STR.close,
      color: COLORS.darkBrown,
      padX: 14,
      padY: 6,
      // Mêmes nombres que le rayon : ils sont relevés sur les bornes réelles du
      // bouton rendu, pas déduites de sa position déclarée (cf. CombScene).
      x: -53,
      y: INNER.y + 8,
      onClick: () => {
        this.close()
      },
    })

    // UN SEUL bouton, et il ne fait qu'une chose : essaimer. L'écran n'a pas de
    // mode — on l'ouvre, on dépense, on ferme —, donc rien à valider en sortant.
    this.action = button(ui.topLeft, {
      font: FONT_KEY,
      size: FONTS.sizeHint,
      label: STR.swarm,
      color: COLORS.darkBrown,
      width: 220,
      padY: 8,
      x: INNER.x + INNER.w / 2,
      y: ACTION_Y,
      onClick: () => {
        this.act()
      },
    })

    // Jauge, bourse, détail et avertissement restent hors pixui : leur texte
    // change à chaque frame (cf. CombScene).
    this.progress = pixelText(this, INNER.x, COUNT_Y, '', FONTS.sizeHint, HEX.cream)
      .setOrigin(0, 0)
      .setTint(PALETTE.oliveBrown)

    // LA BOURSE, en face de la jauge. La barre du haut porte déjà la gelée, mais
    // c'est ICI qu'on la dépense : le prix d'un nœud ne se compare pas à un
    // nombre qu'il faut aller chercher au-dessus de l'écran.
    this.purse = pixelText(this, INNER.x + INNER.w, COUNT_Y, '', FONTS.sizeHint, HEX.cream)
      .setOrigin(1, 0)
      .setTint(PALETTE.amber)
    this.purseCoin = this.add
      .image(0, COUNT_Y + FONTS.sizeHint / 2, TEX.iconJellySmall)
      .setOrigin(1, 0.5)
      .setTint(COLORS.cream)
    this.detailName = pixelText(this, INNER.x, DETAIL_Y, '', FONTS.sizeHint, HEX.cream)
      .setOrigin(0, 0)
      .setTint(PALETTE.amber)
    this.detail = pixelText(
      this,
      INNER.x,
      DETAIL_Y + FONTS.sizeHint + 4,
      '',
      FONTS.sizeHint,
      HEX.cream,
    ).setOrigin(0, 0)

    // L'avertissement se tient JUSTE AU-DESSUS du bouton : ce que l'essaimage
    // emporte doit se lire dans le même regard que le geste qui l'emporte.
    this.warning = pixelText(this, INNER.x + INNER.w / 2, WARN_Y, '', FONTS.sizeHint, HEX.cream)
      .setOrigin(0.5, 0)
      .setCenterAlign()
  }

  private buildGrid(): void {
    GRID.forEach((kind, i) => {
      const col = i % COLS
      const row = Math.floor(i / COLS)
      const cx = INNER.x + (INNER.w / COLS) * (col + 0.5)
      const y = GRID_Y + row * ROW_H

      pixelText(this, cx, y, LINEAGE_STR[kind].name, FONTS.sizeHint, HEX.cream)
        .setOrigin(0.5, 0)
        .setTint(PALETTE.amber)

      const branch = LINEAGE.filter((n) => n.kind === kind)
      branch.forEach((node, k) => {
        const x = cx + (k - (branch.length - 1) / 2) * STEP_X
        this.views.push(this.buildNode(node, x, y + HEX_DROP))
      })
    })
  }

  private buildNode(node: LineageNode, x: number, y: number): NodeView {
    const root = this.add.container(x, y)

    const hex = this.add.image(0, 0, TEX.hexIdle)
    hex.setInteractive({ useHandCursor: false })
    handCursor(hex)
    hex.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => (this.hovered = node))
    hex.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      if (this.hovered === node) this.hovered = null
    })
    hex.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      this.tryBuy(node)
    })

    // Dans l'hexagone : le RANG, et rien d'autre. Le nom est écrit une fois pour
    // la branche entière, au-dessus — le répéter trois fois n'apprendrait rien et
    // ne tiendrait pas dans la place.
    const name = pixelText(this, 0, -10, lineageTierLabel(node) || '*', FONTS.sizeHint, HEX.cream)
      .setOrigin(0.5, 0.5)
      .setCenterAlign()

    const coin = this.add.image(0, 16, TEX.iconJellySmall).setOrigin(0.5, 0.5).setTint(COLORS.cream)
    const cost = pixelText(this, 0, 16, `${node.cost}`, FONTS.sizeHint, HEX.cream).setOrigin(0, 0.5)

    root.add([hex, name, coin, cost])
    return { node, root, hex, name, coin, cost }
  }

  // --- Entrées -------------------------------------------------------------

  private wireInput(): void {
    this.setGameInput(false)
    this.input.keyboard?.on('keydown-ESC', () => {
      this.close()
    })
  }

  private tryBuy(node: LineageNode): void {
    if (!gameState.canBuyLineage(node)) return
    gameState.buyLineage(node)
    gameState.save()
    this.refresh()
  }

  /**
   * L'ESSAIMAGE, en deux clics. Le premier arme et le dit ; le second part. Le
   * désarmement se fait tout seul au bout de quelques secondes : une amorce
   * oubliée est un piège tendu au clic suivant.
   *
   * Il relance la scène de jeu sur-le-champ, car elle tient un lecteur de
   * trajet, un pré et une abeille qui appartiennent à la colonie qu'on vient
   * d'abandonner : la laisser tourner déposerait encore le nectar d'un tour qui
   * n'existe plus, et le pré doit être resemé avec les fleurs héritées.
   */
  private act(): void {
    if (!this.armed) {
      this.armed = true
      this.armTimer?.remove()
      this.armTimer = this.time.delayedCall(ARM_MS, () => {
        this.armed = false
        this.armTimer = null
      })
      this.refresh()
      return
    }
    this.disarm()
    gameState.swarm()
    this.restartGame()
    this.refresh()
  }

  private disarm(): void {
    this.armed = false
    this.armTimer?.remove()
    this.armTimer = null
  }

  /** Relance la scène de jeu, entrées toujours coupées : l'arbre a la main. */
  private restartGame(): void {
    const game = this.scene.get('Game')
    if (!game) return
    game.events.once(Phaser.Scenes.Events.CREATE, () => {
      this.setGameInput(false)
    })
    game.scene.restart()
  }

  private close(): void {
    // Rendre la main au pré une frame PLUS TARD : les deux scènes écoutent Échap
    // dans la même frame, et la touche qui ferme l'arbre ouvrirait sinon le menu
    // de pause derrière (cf. CombScene).
    const game = this.scene.get('Game')
    if (game)
      game.time.delayedCall(0, () => {
        this.setGameInput(true)
      })
    this.scene.stop()
  }

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
    const jelly = gameState.royalJelly
    const spendable = gameState.canSpendJelly

    for (const view of this.views) {
      const { node } = view
      const owned = gameState.ownsLineage(node)
      // « À portée » se lit sur la GELÉE, pas sur le droit de dépenser : un nœud
      // payable doit s'allumer même avant l'essaimage — c'est ce qui donne envie
      // de le faire.
      const affordable = !owned && gameState.lineageReachable(node) && jelly >= node.cost

      view.hex.setTexture(owned ? TEX.hexDone : affordable ? TEX.hexReady : TEX.hexIdle)
      const dim = owned || affordable ? 1 : DIM_ALPHA
      view.name.setAlpha(dim)
      view.cost.setTint(owned ? PALETTE.lime : COLORS.cream)
      view.cost.setAlpha(dim)
      view.cost.setText(owned ? STR.lineageOwned : `${node.cost}`)

      // Un nœud acquis n'a plus de prix : la vignette s'efface et le mot se
      // recentre seul (cf. CombScene).
      view.coin.visible = !owned
      view.coin.setAlpha(dim)
      const total = owned ? view.cost.width : COIN + COIN_GAP + view.cost.width
      view.coin.x = -total / 2 + COIN / 2
      view.cost.x = owned ? -total / 2 : -total / 2 + COIN + COIN_GAP
    }

    this.progress.setText(
      STR.lineageCount
        .replace('{n}', `${gameState.lineage.size}`)
        .replace('{t}', `${LINEAGE_TOTAL}`),
    )

    // LA BOURSE. Le prix des nœuds est juste au-dessus : la réserve se lit sur
    // la même ligne que la jauge, à l'autre bout, pour qu'un prix se compare
    // sans quitter l'écran des yeux.
    this.purse.setText(STR.lineagePurse.replace('{n}', fmtFine(jelly)))
    this.purseCoin.x = INNER.x + INNER.w - this.purse.width - COIN_GAP

    // La ligne de détail dit ce que fait le nœud survolé, ET pourquoi il ne
    // s'achète pas encore ; à défaut, elle dit où en est la lignée. C'est la
    // question que se pose le joueur qui ouvre cet écran pour la première fois.
    const hovered = this.hovered
    if (hovered) {
      const tier = lineageTierLabel(hovered)
      this.detailName.setText(`${LINEAGE_STR[hovered.kind].name}${tier ? ` ${tier}` : ''}`)
      this.detail.setText(wrap(`${LINEAGE_STR[hovered.kind].tip} ${this.blocker(hovered)}`, 148))
    } else {
      this.detailName.setText('')
      this.detail.setText(
        wrap(
          !spendable
            ? STR.lineageLocked
            : gameState.lineageHasOffer
              ? STR.lineageSpend
              : STR.lineagePoor,
          148,
        ),
      )
    }

    // Le bas de l'écran : UN bouton, toujours là. L'arbre ne se referme plus
    // derrière lui — il reste le guichet, l'essaimage n'en est que le prix.
    setText(this.action.label, this.armed ? STR.swarmConfirm : STR.swarm)
    this.warning.setText(STR.swarmWarn)
  }

  /** Ce qui manque pour acheter ce nœud. Chaîne vide s'il est libre ou acquis. */
  private blocker(node: LineageNode): string {
    if (gameState.ownsLineage(node)) return ''
    if (!gameState.lineageReachable(node)) return STR.lineageNeedsTier
    if (gameState.royalJelly < node.cost) {
      return STR.lineageTooDear
        .replace('{c}', `${node.cost}`)
        .replace('{n}', fmtFine(gameState.royalJelly))
    }
    return gameState.canSpendJelly ? '' : STR.lineageLocked
  }
}
