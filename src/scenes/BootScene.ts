import Phaser from 'phaser'
import { bakeAll } from '../gfx/textures'

// Génère les textures placeholder puis passe au titre.
// (Plus tard : préchargement des vrais assets pixel + audio ici.)
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  create(): void {
    bakeAll(this)
    this.scene.start('Title')
  }
}
