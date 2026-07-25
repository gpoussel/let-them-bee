import Phaser from 'phaser'
import { CREDITS, STR } from '../config/strings'
import { GAME, WORLD } from '../config/game'
import { COLORS, FONTS } from '../ui/theme'
import { FONT_KEY } from '../gfx/font'
import {
  Ui,
  Panel,
  button,
  iconButton,
  ninePanel,
  handCursor,
  slider,
  UI9,
  OriginX,
  OriginY,
} from '../ui/pixui'
import { TEX } from '../gfx/textures'
import { createLogo } from '../gfx/logo'
import { gameState, GameState } from '../systems/GameState'
import { audio, SND } from '../systems/Audio'
import { settings } from '../systems/Settings'

const ITCH_RED = 0xfa5c5c // couleur de marque itch.io (survol de son icône)

// Barre de bas d'écran : version à gauche, crédit jam au centre, icônes à droite.
const FOOTER_Y = 10
const ICON_GAP = 40
const ICON_SIZE = 32
const ICON_MARGIN = 12

// Dimensions de la pop-up de crédits (texte en taille « hint » : les lignes de
// crédits sont longues et doivent tenir sur une ligne).
const ABOUT_W = 420
const ABOUT_H = 268
const ABOUT_LINE_H = 18
const ABOUT_LABEL_X = 20
const ABOUT_VALUE_X = 110

// Dimensions de la pop-up de réglages (deux curseurs de volume + bouton Done).
const PREFS_W = 340
const PREFS_H = 200
const PREFS_PAD_X = 28
const PREFS_SLIDER_W = PREFS_W - PREFS_PAD_X * 2

// Écran-titre : logo, boutons Butiner / Continuer / Reset, barre de bas d'écran
// (version, crédit jam, liens itch.io / GitHub / crédits).
// Layout entièrement posé via pixui (ancré au centre / aux bords de l'écran).
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title')
  }

  create(): void {
    const { width, height } = WORLD
    // Fond : le jardin baké au boot, posé à l'origine (il couvre l'écran).
    this.add.image(0, 0, TEX.garden).setOrigin(0, 0)

    const hasSave = gameState.load()
    const ui = new Ui(this)
    const center = ui.center

    // Offsets exprimés depuis le centre de l'écran.
    const cy = height / 2
    // Le bouton principal se place à mi-hauteur entre l'accroche et la barre
    // de bas d'écran ; le meilleur score, quand il existe, s'intercale dessous.
    const taglineY = height * 0.3 + 132
    const footerTopY = height - FOOTER_Y - ICON_SIZE
    const buttonY = (taglineY + footerTopY) / 2
    const scoreY = (buttonY + footerTopY) / 2
    center.bitmapText({
      font: FONT_KEY,
      size: FONTS.sizeSmall,
      text: STR.tagline,
      tint: COLORS.amberSoft,
      x: 0,
      y: taglineY - cy,
      originX: OriginX.Center,
      originY: OriginY.Center,
    })

    // Bouton principal.
    button(center, {
      font: FONT_KEY,
      size: FONTS.sizeButton,
      label: hasSave ? STR.continue : STR.play,
      color: COLORS.darkBrown,
      x: 0,
      y: buttonY - cy,
      onClick: () => this.scene.start('Game'),
    })

    if (hasSave) {
      // Meilleur score / reines : rien à afficher tant qu'aucune partie n'a
      // été jouée.
      center.bitmapText({
        font: FONT_KEY,
        size: FONTS.sizeSmall,
        text: `${STR.best} ${STR.honey.toLowerCase()}: ${Math.floor(gameState.bestHoney)}   -   ${STR.queens}: ${gameState.queens}`,
        tint: COLORS.cream,
        x: 0,
        y: scoreY - cy,
        originX: OriginX.Center,
        originY: OriginY.Center,
      })

      button(center, {
        font: FONT_KEY,
        size: FONTS.sizeButton,
        label: STR.reset,
        color: COLORS.darkBrown,
        x: 0,
        y: (scoreY + footerTopY) / 2 - cy,
        onClick: () => {
          GameState.clear()
          this.scene.restart()
        },
      })
    }

    this.buildFooter(ui)
    this.buildPrefsButton(ui)
    const about = this.buildAbout(ui)
    const prefs = this.buildPrefs(ui)

    ui.commit()

    // Logo animé (pixel art, x3) au-dessus du layout.
    createLogo(this, width / 2, height * 0.3, 3)

    // La pop-up est construite en même temps que le reste (pixui ne fige le
    // layout qu'une fois) : on la masque puis on la remonte au premier plan,
    // au-dessus du logo ajouté après commit().
    about.bringToTop()
    about.visible = false
    prefs.bringToTop()
    prefs.visible = false

    // Escape : ferme la pop-up ouverte, ou ouvre les réglages s'il n'y en a
    // aucune.
    this.input.keyboard?.on('keydown-ESC', () => {
      if (about.visible) this.toggleAbout(false)
      else this.togglePrefs(!prefs.visible)
    })

    // Musique de fond de l'écran-titre (boucle). Le gestionnaire attend le
    // déblocage audio du navigateur si nécessaire.
    audio.playMusic(SND.titleTheme)
  }

  /** Icône d'accès aux réglages, en haut à droite de l'écran. */
  private buildPrefsButton(ui: Ui): void {
    iconButton(ui.topRight, {
      texture: TEX.iconPrefs,
      x: ICON_MARGIN,
      y: FOOTER_Y,
      originX: OriginX.Right,
      originY: OriginY.Top,
      tintHover: COLORS.amberSoft,
      onClick: () => this.togglePrefs(true),
    })
  }

  /** Version, crédit jam et icônes de liens, collés au bas de l'écran. */
  private buildFooter(ui: Ui): void {
    ui.bottomLeft.bitmapText({
      font: FONT_KEY,
      size: FONTS.sizeSmall,
      text: `v${GAME.version}`,
      tint: COLORS.cream,
      x: 8,
      y: FOOTER_Y,
      originX: OriginX.Left,
      originY: OriginY.Bottom,
    })

    // Crédit jam, cliquable → page itch.io de la DTJ36-28.
    const jam = ui.bottomCenter.bitmapText({
      font: FONT_KEY,
      size: FONTS.sizeSmall,
      text: STR.jamCredit,
      tint: COLORS.cream,
      x: 0,
      y: FOOTER_Y,
      originX: OriginX.Center,
      originY: OriginY.Bottom,
    })
    const jamHit = ui.bottomCenter.clickable({
      x: 0,
      y: FOOTER_Y,
      width: jam.width + 12,
      height: jam.height + 6,
      originX: OriginX.Center,
      originY: OriginY.Bottom,
      onClick: () => this.openLink(STR.jamUrl),
      onUpdate: () => {
        jam.tint = jamHit.hovered ? COLORS.amberSoft : COLORS.cream
      },
    })
    handCursor(jamHit.events)

    // Icônes de droite à gauche : about, GitHub, itch.io. Elles sont crème au
    // repos et prennent leur couleur de marque au survol.
    const icons: Array<{ texture: string; tintHover: number; onClick: () => void }> = [
      { texture: TEX.iconAbout, tintHover: COLORS.amberSoft, onClick: () => this.toggleAbout(true) },
      {
        texture: TEX.iconGithub,
        tintHover: COLORS.amberSoft,
        onClick: () => this.openLink(STR.githubUrl),
      },
      { texture: TEX.iconItch, tintHover: ITCH_RED, onClick: () => this.openLink(STR.itchUrl) },
    ]
    icons.forEach((icon, i) => {
      iconButton(ui.bottomRight, {
        texture: icon.texture,
        x: ICON_MARGIN + i * ICON_GAP,
        y: FOOTER_Y,
        originX: OriginX.Right,
        originY: OriginY.Bottom,
        tintHover: icon.tintHover,
        onClick: icon.onClick,
      })
    })
  }

  private about?: Panel

  /** Pop-up de crédits (masquée par défaut). */
  private buildAbout(ui: Ui): Panel {
    // Voile plein écran : assombrit la scène ET absorbe les clics extérieurs.
    const overlay = ui.panel({
      x: 0,
      y: 0,
      width: WORLD.width,
      height: WORLD.height,
      originX: OriginX.Center,
      originY: OriginY.Center,
    })
    overlay.center.rectangle({
      width: WORLD.width,
      height: WORLD.height,
      fillColor: COLORS.bgDark,
      fillAlpha: 0.75,
    })
    overlay.center.clickable({
      width: WORLD.width,
      height: WORLD.height,
      onClick: () => this.toggleAbout(false),
    })

    // Cadre de la pop-up (tileset d'interface, étiré en nine-slice).
    ninePanel(overlay.center, { width: ABOUT_W, height: ABOUT_H, skin: UI9.insetDark })
    // Le cadre absorbe les clics pour ne pas refermer la pop-up par mégarde.
    overlay.center.clickable({ width: ABOUT_W, height: ABOUT_H, onClick: () => {} })

    const topLeft = overlay.topLeft
    const frameX = (WORLD.width - ABOUT_W) / 2
    const frameY = (WORLD.height - ABOUT_H) / 2

    overlay.center.bitmapText({
      font: FONT_KEY,
      size: FONTS.sizeSmall,
      text: STR.about,
      tint: COLORS.honey,
      x: 0,
      y: frameY + 22 - WORLD.height / 2,
      originX: OriginX.Center,
      originY: OriginY.Center,
    })

    CREDITS.forEach((line, i) => {
      const y = frameY + 60 + i * ABOUT_LINE_H
      if (line.label) {
        topLeft.bitmapText({
          font: FONT_KEY,
          size: FONTS.sizeHint,
          text: `${line.label}:`,
          tint: COLORS.darkBrown,
          x: frameX + ABOUT_LABEL_X,
          y,
          originX: OriginX.Left,
          originY: OriginY.Top,
        })
      }
      topLeft.bitmapText({
        font: FONT_KEY,
        size: FONTS.sizeHint,
        text: line.value,
        tint: COLORS.cream,
        x: frameX + (line.label ? ABOUT_VALUE_X : ABOUT_LABEL_X),
        y,
        originX: OriginX.Left,
        originY: OriginY.Top,
      })
    })

    button(overlay.center, {
      font: FONT_KEY,
      size: FONTS.sizeHint,
      label: STR.close,
      color: COLORS.darkBrown,
      padX: 14,
      padY: 6,
      x: 0,
      y: frameY + ABOUT_H - 26 - WORLD.height / 2,
      onClick: () => this.toggleAbout(false),
    })

    this.about = overlay
    return overlay
  }

  private prefs?: Panel
  /** Horodatage du dernier aperçu sonore, pour ne pas mitrailler le SFX. */
  private lastSfxPreview = 0

  /** Pop-up de réglages : volumes musique et SFX (masquée par défaut). */
  private buildPrefs(ui: Ui): Panel {
    // Voile plein écran : assombrit la scène ET absorbe les clics extérieurs.
    const overlay = ui.panel({
      x: 0,
      y: 0,
      width: WORLD.width,
      height: WORLD.height,
      originX: OriginX.Center,
      originY: OriginY.Center,
    })
    overlay.center.rectangle({
      width: WORLD.width,
      height: WORLD.height,
      fillColor: COLORS.bgDark,
      fillAlpha: 0.75,
    })
    overlay.center.clickable({
      width: WORLD.width,
      height: WORLD.height,
      onClick: () => this.togglePrefs(false),
    })

    ninePanel(overlay.center, { width: PREFS_W, height: PREFS_H, skin: UI9.insetDark })
    // Le cadre absorbe les clics pour ne pas refermer la pop-up par mégarde.
    overlay.center.clickable({ width: PREFS_W, height: PREFS_H, onClick: () => {} })

    const frameX = (WORLD.width - PREFS_W) / 2
    const frameY = (WORLD.height - PREFS_H) / 2
    const topLeft = overlay.topLeft

    overlay.center.bitmapText({
      font: FONT_KEY,
      size: FONTS.sizeSmall,
      text: STR.settings,
      tint: COLORS.honey,
      x: 0,
      y: frameY + 26 - WORLD.height / 2,
      originX: OriginX.Center,
      originY: OriginY.Center,
    })

    const rows: Array<{ label: string; value: number; onChange: (v: number) => void }> = [
      {
        label: STR.musicVolume,
        value: settings.musicVolume,
        onChange: (v) => settings.setMusicVolume(v),
      },
      {
        label: STR.sfxVolume,
        value: settings.sfxVolume,
        onChange: (v) => {
          settings.setSfxVolume(v)
          this.previewSfx()
        },
      },
    ]

    rows.forEach((row, i) => {
      const y = frameY + 58 + i * 54
      topLeft.bitmapText({
        font: FONT_KEY,
        size: FONTS.sizeHint,
        text: row.label,
        tint: COLORS.cream,
        x: frameX + PREFS_PAD_X,
        y,
        originX: OriginX.Left,
        originY: OriginY.Top,
      })
      slider(topLeft, {
        x: frameX + PREFS_PAD_X,
        y: y + 16,
        width: PREFS_SLIDER_W,
        value: row.value,
        onChange: row.onChange,
      })
    })

    button(overlay.center, {
      font: FONT_KEY,
      size: FONTS.sizeHint,
      label: STR.done,
      color: COLORS.darkBrown,
      padX: 14,
      padY: 6,
      x: 0,
      y: frameY + PREFS_H - 26 - WORLD.height / 2,
      onClick: () => this.togglePrefs(false),
    })

    this.prefs = overlay
    return overlay
  }

  /** Aperçu du volume SFX pendant le glissé, limité en fréquence. */
  private previewSfx(): void {
    const now = this.time.now
    if (now - this.lastSfxPreview < 150) return
    this.lastSfxPreview = now
    audio.playClick()
  }

  private togglePrefs(open: boolean): void {
    if (!this.prefs) return
    if (open) {
      this.toggleAbout(false)
      this.prefs.bringToTop()
    }
    this.prefs.visible = open
  }

  private toggleAbout(open: boolean): void {
    if (!this.about) return
    if (open) {
      this.togglePrefs(false)
      this.about.bringToTop()
    }
    this.about.visible = open
  }

  private openLink(url: string): void {
    window.open(url, '_blank', 'noopener')
  }
}
