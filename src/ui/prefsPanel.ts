import type Phaser from 'phaser'
import { WORLD } from '../config/game'
import { STR } from '../config/strings'
import { COLORS, FONTS } from './theme'
import { FONT_KEY } from '../gfx/font'
import { type Ui, type Panel, button, ninePanel, slider, UI9, OriginX, OriginY } from './pixui'
import { audio } from '../systems/Audio'
import { settings } from '../systems/Settings'

// Pop-up de réglages (volumes musique et SFX), partagée par l'écran-titre et le
// menu de pause en jeu — ce dernier n'ajoute qu'un bouton « Back to title ».

const PREFS_W = 340
/** Hauteur du cadre sans bouton additionnel (titre + 2 curseurs + Done). */
const PREFS_BASE_H = 200
/** Hauteur ajoutée par bouton additionnel. */
const EXTRA_BUTTON_H = 44
const PREFS_PAD_X = 28
const PREFS_SLIDER_W = PREFS_W - PREFS_PAD_X * 2
/** Intervalle minimal entre deux aperçus sonores pendant le glissé (ms). */
const SFX_PREVIEW_MS = 150

export interface PrefsPanelOpts {
  /** Boutons intercalés entre les curseurs et le bouton Done. */
  extraButtons?: { label: string; onClick: () => void }[]
  /** Fermeture : bouton Done et clic hors du cadre. */
  onClose: () => void
}

/**
 * Construit la pop-up de réglages dans `ui` et renvoie son panel (voile
 * compris). L'appelant reste maître de sa visibilité et doit appeler
 * `ui.commit()`.
 */
export function buildPrefsPanel(scene: Phaser.Scene, ui: Ui, o: PrefsPanelOpts): Panel {
  const extras = o.extraButtons ?? []
  const height = PREFS_BASE_H + extras.length * EXTRA_BUTTON_H

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
    onClick: () => {
      o.onClose()
    },
  })

  ninePanel(overlay.center, { width: PREFS_W, height, skin: UI9.insetDark })
  // Le cadre absorbe les clics pour ne pas refermer la pop-up par mégarde.
  overlay.center.clickable({ width: PREFS_W, height, onClick: () => {} })

  const frameX = (WORLD.width - PREFS_W) / 2
  const frameY = (WORLD.height - height) / 2
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

  // Aperçu du volume SFX pendant le glissé, limité en fréquence.
  let lastSfxPreview = 0
  const previewSfx = (): void => {
    if (scene.time.now - lastSfxPreview < SFX_PREVIEW_MS) return
    lastSfxPreview = scene.time.now
    audio.playClick()
  }

  const rows: { label: string; value: number; onChange: (v: number) => void }[] = [
    {
      label: STR.musicVolume,
      value: settings.musicVolume,
      onChange: (v) => {
        settings.setMusicVolume(v)
      },
    },
    {
      label: STR.sfxVolume,
      value: settings.sfxVolume,
      onChange: (v) => {
        settings.setSfxVolume(v)
        previewSfx()
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

  extras.forEach((extra, i) => {
    button(overlay.center, {
      font: FONT_KEY,
      size: FONTS.sizeHint,
      label: extra.label,
      color: COLORS.darkBrown,
      padX: 14,
      padY: 6,
      x: 0,
      y: frameY + 176 + i * EXTRA_BUTTON_H - WORLD.height / 2,
      onClick: extra.onClick,
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
    y: frameY + height - 26 - WORLD.height / 2,
    onClick: () => {
      o.onClose()
    },
  })

  return overlay
}
