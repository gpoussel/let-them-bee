import Phaser from 'phaser'
import { bakeAll, TEX } from '../gfx/textures'
import { bakeFont } from '../gfx/font'
import { bakeLogo } from '../gfx/logo'
import { bakeUi9 } from '../gfx/ui9'

// Génère les textures placeholder puis passe au titre.
// (Plus tard : préchargement des vrais assets pixel + audio ici.)
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  preload(): void {
    this.load.image(TEX.logo, 'img/logo.png')
    this.load.image(TEX.ui, 'img/ui.png')
  }

  create(): void {
    this.textures.get(TEX.logo).setFilter(Phaser.Textures.FilterMode.NEAREST)
    bakeLogo(this)
    bakeUi9(this)
    bakeAll(this)
    bakeFont(this)
    this.scene.start('Title')
  }
}
