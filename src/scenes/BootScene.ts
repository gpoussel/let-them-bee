import Phaser from 'phaser'
import { bakeAll, TEX } from '../gfx/textures'
import { bakeFont } from '../gfx/font'

// Génère les textures placeholder puis passe au titre.
// (Plus tard : préchargement des vrais assets pixel + audio ici.)
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  preload(): void {
    this.load.image(TEX.logo, 'img/logo.png')
  }

  create(): void {
    this.textures.get(TEX.logo).setFilter(Phaser.Textures.FilterMode.NEAREST)
    bakeAll(this)
    bakeFont(this)
    this.scene.start('Title')
  }
}
