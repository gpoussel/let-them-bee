import Phaser from 'phaser'
import { bakeAll, TEX } from '../gfx/textures'
import { bakeFont } from '../gfx/font'
import { bakeLogo } from '../gfx/logo'
import { bakeSlider, bakeUi9 } from '../gfx/ui9'
import { bakeGarden, TILE } from '../gfx/garden'
import { WORLD } from '../config/game'
import { audio, SND } from '../systems/Audio'

// Génère les textures placeholder puis passe au titre.
// (Plus tard : préchargement des vrais assets pixel + audio ici.)
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  preload(): void {
    this.load.image(TEX.logo, 'img/logo.png')
    this.load.image(TEX.ui, 'img/ui.png')
    this.load.image(TEX.uiSlider, 'img/ui-slider.png')
    this.load.image(TEX.tileset, 'img/garden-tiles.png')
    this.load.image(TEX.objects, 'img/garden-objects.png')
    this.load.audio(SND.click, 'audio/ui-click.ogg')
    this.load.audio(SND.titleTheme, 'audio/title-theme.ogg')
  }

  create(): void {
    this.textures.get(TEX.logo).setFilter(Phaser.Textures.FilterMode.NEAREST)
    bakeLogo(this)
    bakeUi9(this)
    bakeSlider(this)
    bakeGarden(this, {
      key: TEX.garden,
      cols: Math.ceil(WORLD.width / TILE),
      rows: Math.ceil(WORLD.height / TILE),
    })
    bakeAll(this)
    bakeFont(this)
    audio.install(this)
    this.scene.start('Title')
  }
}
