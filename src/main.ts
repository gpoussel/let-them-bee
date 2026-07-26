import Phaser from 'phaser'
import { GAME, WORLD } from './config/game'
import { COLORS } from './ui/theme'
import { BootScene } from './scenes/BootScene'
import { TitleScene } from './scenes/TitleScene'
import { GameScene } from './scenes/GameScene'
import { CombScene } from './scenes/CombScene'
import { PauseScene } from './scenes/PauseScene'
import { installCursors } from './ui/cursor'
import { gameState } from './systems/GameState'

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
  // Le rayon passe APRÈS le jeu (il le recouvre) mais AVANT la pause : un menu
  // de pause doit pouvoir s'ouvrir par-dessus tout, rayon compris.
  scene: [BootScene, TitleScene, GameScene, CombScene, PauseScene],
})

game.events.once(Phaser.Core.Events.READY, () => installCursors(game))

// Hooks de debug en dev uniquement (accès au jeu depuis la console / tests).
// `__state` expose l'INSTANCE partagée : la réimporter depuis la console donne
// un autre module, donc un autre état, et on croit tester ce qu'on ne teste pas.
if (import.meta.env.DEV) {
  const w = window as unknown as { __game: Phaser.Game; __state: typeof gameState }
  w.__game = game
  w.__state = gameState
}
