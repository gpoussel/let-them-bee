import Phaser from 'phaser'
import { bakeAll, TEX } from '../gfx/textures'
import { bakeFont } from '../gfx/font'
import { bakeLogo } from '../gfx/logo'
import { bakeSlider, bakeUi9 } from '../gfx/ui9'
import { bakeGarden, TILE } from '../gfx/garden'
import { bakeFlowers } from '../gfx/flowers'
import { bakeHex } from '../gfx/transition'
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
    this.load.audio(SND.forage, 'audio/sfx-forage.ogg')
    this.load.audio(SND.honey, 'audio/sfx-honey.ogg')
    this.load.audio(SND.newBest, 'audio/sfx-new-best.ogg')
    this.load.audio(SND.titleTheme, 'audio/title-theme.ogg')
    this.load.audio(SND.gameTheme, 'audio/game-theme.ogg')
  }

  create(): void {
    this.textures.get(TEX.logo).setFilter(Phaser.Textures.FilterMode.NEAREST)
    bakeLogo(this)
    bakeUi9(this)
    bakeSlider(this)
    bakeFlowers(this)
    const cols = Math.ceil(WORLD.width / TILE)
    const rows = Math.ceil(WORLD.height / TILE)
    bakeGarden(this, { key: TEX.garden, cols, rows })
    // Décor de l'écran de jeu : la même prairie, mais nue — l'interface s'y
    // pose et l'abeille y vole.
    bakeGarden(this, { key: TEX.gardenField, cols, rows, style: 'meadow', seed: 21 })
    bakeAll(this)
    bakeHex(this)
    bakeFont(this)
    audio.install(this)
    this.scene.start('Title')
  }
}
