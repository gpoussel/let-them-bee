import Phaser from 'phaser'
import { GAME, WORLD } from './config/game'
import { COLORS } from './ui/theme'
import { BootScene } from './scenes/BootScene'
import { TitleScene } from './scenes/TitleScene'
import { GameScene } from './scenes/GameScene'
import { installCursors } from './ui/cursor'

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WORLD.width,
  height: WORLD.height,
  backgroundColor: COLORS.bgDark,
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  title: GAME.name,
  scene: [BootScene, TitleScene, GameScene],
})

game.events.once(Phaser.Core.Events.READY, () => installCursors(game))

// Hook de debug en dev uniquement (accès au jeu depuis la console / tests).
if (import.meta.env.DEV) {
  ;(window as unknown as { __game: Phaser.Game }).__game = game
}
