// OUTILS DE DÉVELOPPEMENT — menu de triche, chargé UNIQUEMENT en dev.
//
// Il ne se voit jamais dans un build de production : `main.ts` ne l'importe que
// derrière `import.meta.env.DEV`, donc ce module (et lui seul) disparaît du
// bundle final. C'est pour ça qu'il vit dans `src/dev/` à part.
//
// C'est du DOM ordinaire, posé par-dessus le canvas, dans la police du système :
// ce n'est pas de l'interface de jeu et ça ne doit surtout pas y ressembler —
// on ne veut pas se demander en jouant si ce qu'on voit fait partie du jeu.

import type Phaser from 'phaser'
import { COMB } from '../config/upgrades'
import { gameState } from '../systems/GameState'
import type { FlowerField } from '../systems/FlowerField'
import type { Route } from '../systems/Route'
import { planRoute } from './planRoute'

/** Touche d'ouverture / fermeture. */
const TOGGLE_KEY = 'Tab'
/** Pas de gain / perte proposés pour chaque ressource. */
const STEPS = [10, 100, 1000] as const
/** Rafraîchissement des compteurs affichés, en ms. */
const REFRESH_MS = 200
/** Vitesses proposées. x1 en tête : c'est le jeu tel qu'il est joué. */
const SPEEDS = [1, 2, 4] as const

/**
 * Prise exposée par la scène de jeu (cf. `GameScene.devContext`). Elle est
 * décrite ici en structurel : le menu ne veut pas dépendre de la scène, et la
 * scène n'a rien à savoir des outils.
 */
interface DevContext {
  hive: { x: number; y: number }
  origin: { x: number; y: number }
  reachRise: number
  forageRadius: number
  speed: number
  growthMult: number
  /** Accélérateur courant du temps de la scène (1 en jeu normal). */
  timeScale: () => number
  setTimeScale: (mult: number) => void
  /** Pré de simulation, identique à celui affiché mais indépendant de lui. */
  newField: () => FlowerField
  /** Adopte le trajet sans le comparer au précédent, et repart en relecture. */
  applyRoute: (route: Route) => void
}

interface SceneWithDevContext extends Phaser.Scene {
  devContext(): DevContext
}

type Resource = 'nectar' | 'honey' | 'royalJelly'

const RESOURCES: { id: Resource; label: string }[] = [
  { id: 'nectar', label: 'Nectar' },
  { id: 'honey', label: 'Miel' },
  { id: 'royalJelly', label: 'Gelée royale' },
]

const CSS = `
.ltb-dev {
  position: fixed; top: 12px; right: 12px; z-index: 9999;
  width: 460px; padding: 14px 16px 16px;
  background: rgba(20, 22, 26, 0.94); color: #e8e8ea;
  border: 1px solid #4b4f57; border-radius: 6px;
  font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
  user-select: none;
}
.ltb-dev[hidden] { display: none; }
.ltb-dev h2 {
  margin: 0 0 12px; font-size: 12px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.08em; color: #9aa0aa;
}
.ltb-dev-row { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
.ltb-dev-name { flex: 0 0 92px; }
.ltb-dev-val {
  flex: 0 0 56px; text-align: right; padding-right: 8px;
  font-variant-numeric: tabular-nums; font-family: ui-monospace, monospace; color: #ffd76a;
}
.ltb-dev button {
  font: inherit; color: #e8e8ea; background: #2f333b;
  border: 1px solid #575c66; border-radius: 4px; padding: 6px 4px; cursor: pointer;
  white-space: nowrap;
}
.ltb-dev button:hover { background: #3d434d; }
.ltb-dev button:active { background: #565d69; }
.ltb-dev-row button { flex: 1 1 0; min-width: 0; }
.ltb-dev-radio {
  flex: 1 1 0; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 6px 0; border: 1px solid #575c66; border-radius: 4px;
  background: #2f333b; cursor: pointer;
}
.ltb-dev-radio:hover { background: #3d434d; }
.ltb-dev-radio:has(input:checked) { background: #565d69; border-color: #8b93a0; }
.ltb-dev-radio input { margin: 0; cursor: pointer; }
.ltb-dev-wide { display: block; width: 100%; margin-top: 8px; padding: 9px 0; }
.ltb-dev-msg { margin-top: 12px; min-height: 18px; font-size: 13px; color: #9aa0aa; }
.ltb-dev-hint { margin-top: 10px; font-size: 12px; color: #6f757f; }
`

/** Installe le menu et son raccourci clavier. Idempotent. */
export function installDevMenu(game: Phaser.Game): void {
  if (document.querySelector('.ltb-dev')) return

  const style = document.createElement('style')
  style.textContent = CSS
  document.head.append(style)

  const panel = document.createElement('div')
  panel.className = 'ltb-dev'
  panel.hidden = true

  const title = document.createElement('h2')
  title.textContent = 'Dev tools'
  panel.append(title)

  const message = document.createElement('div')
  message.className = 'ltb-dev-msg'

  const say = (text: string): void => {
    message.textContent = text
  }

  // --- Ressources ----------------------------------------------------------

  const values = new Map<Resource, HTMLElement>()

  for (const res of RESOURCES) {
    const row = document.createElement('div')
    row.className = 'ltb-dev-row'

    const name = document.createElement('span')
    name.className = 'ltb-dev-name'
    name.textContent = res.label
    row.append(name)

    const value = document.createElement('span')
    value.className = 'ltb-dev-val'
    values.set(res.id, value)
    row.append(value)

    // Les pertes d'abord, du plus gros au plus petit, puis les gains : la ligne
    // se lit comme un axe, le zéro au milieu.
    for (const amount of [...STEPS]
      .reverse()
      .map((s) => -s)
      .concat([...STEPS])) {
      const btn = document.createElement('button')
      btn.textContent = amount > 0 ? `+${amount}` : `${amount}`
      btn.addEventListener('click', () => {
        grant(res.id, amount)
        say(`${res.label} ${amount > 0 ? '+' : ''}${amount}`)
        refresh()
      })
      row.append(btn)
    }

    panel.append(row)
  }

  // --- Vitesse du jeu ------------------------------------------------------
  //
  // Attendre huit secondes un lot de miel ou une repousse de fleur n'apprend
  // rien : on veut voir la boucle tourner. Des radios et pas des boutons, parce
  // que c'est un ÉTAT — le menu doit dire à quelle vitesse tourne le jeu, pas
  // seulement permettre d'en changer.

  const speedRow = document.createElement('div')
  speedRow.className = 'ltb-dev-row'

  const speedName = document.createElement('span')
  speedName.className = 'ltb-dev-name'
  speedName.textContent = 'Vitesse'
  speedRow.append(speedName)

  const speedInputs = new Map<number, HTMLInputElement>()

  for (const mult of SPEEDS) {
    const label = document.createElement('label')
    label.className = 'ltb-dev-radio'

    const input = document.createElement('input')
    input.type = 'radio'
    input.name = 'ltb-dev-speed'
    input.checked = mult === 1
    input.addEventListener('change', () => {
      const ctx = devContext(game)
      if (!ctx) {
        say('Le potager n’est pas ouvert')
        syncSpeed()
        return
      }
      ctx.setTimeScale(mult)
      say(`Vitesse x${mult}`)
    })
    speedInputs.set(mult, input)

    label.append(input, document.createTextNode(`x${mult}`))
    speedRow.append(label)
  }

  panel.append(speedRow)

  /**
   * Recale les radios sur la vitesse réellement appliquée. La scène de jeu
   * repart à x1 quand elle est recréée (retour au titre, rechargement) : sans
   * ça le menu affirmerait un x4 que plus personne n'applique.
   */
  const syncSpeed = (): void => {
    const current = devContext(game)?.timeScale() ?? 1
    for (const [mult, input] of speedInputs) input.checked = mult === current
  }

  // --- Actions -------------------------------------------------------------

  const action = (label: string, onClick: () => void): void => {
    const btn = document.createElement('button')
    btn.className = 'ltb-dev-wide'
    btn.textContent = label
    btn.addEventListener('click', onClick)
    panel.append(btn)
  }

  action('Programmer un trajet efficace', () => {
    say(programRoute(game))
  })
  action('Débloquer toutes les alvéoles', () => {
    say(unlockAllUpgrades())
    refresh()
  })

  panel.append(message)

  const hint = document.createElement('div')
  hint.className = 'ltb-dev-hint'
  hint.textContent = `${TOGGLE_KEY} : ouvrir / fermer`
  panel.append(hint)

  document.body.append(panel)

  // --- Affichage -----------------------------------------------------------

  const refresh = (): void => {
    for (const [id, el] of values) el.textContent = String(Math.floor(gameState[id]))
  }
  refresh()
  window.setInterval(() => {
    if (!panel.hidden) refresh()
  }, REFRESH_MS)

  // Tabulation en capture : sinon le navigateur déplace le focus et Phaser
  // reçoit la touche avant nous.
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== TOGGLE_KEY || e.altKey || e.ctrlKey || e.metaKey) return
      e.preventDefault()
      e.stopPropagation()
      panel.hidden = !panel.hidden
      if (!panel.hidden) {
        say('')
        refresh()
        syncSpeed()
      }
    },
    true,
  )
}

// --- Actions ---------------------------------------------------------------

/** Prise de la scène de jeu, ou `null` si le potager n'est pas ouvert. */
function devContext(game: Phaser.Game): DevContext | null {
  const scene = game.scene.getScene('Game') as SceneWithDevContext | null
  return scene?.scene.isActive() ? scene.devContext() : null
}

/** Ajoute (ou retire) une ressource, en restant dans ses bornes. */
function grant(id: Resource, amount: number): void {
  const max = id === 'nectar' ? gameState.nectarCapacity : Number.POSITIVE_INFINITY
  gameState[id] = Math.min(max, Math.max(0, gameState[id] + amount))
  // Le meilleur miel sert de repère au prestige : il doit suivre.
  if (id === 'honey' && gameState.honey > gameState.bestHoney) {
    gameState.bestHoney = gameState.honey
  }
  gameState.save()
}

/** Offre toutes les alvéoles du rayon, avec leurs effets, sans les payer. */
function unlockAllUpgrades(): string {
  let added = 0
  for (const cell of COMB) {
    if (gameState.comb.has(cell.id)) continue
    gameState.comb.add(cell.id)
    // Mêmes effets secondaires que l'achat : certaines branches donnent des abeilles.
    gameState.grantCellBees(cell)
    added++
  }
  gameState.save()
  return added > 0 ? `${added} alvéole(s) débloquée(s)` : 'Le rayon était déjà complet'
}

/** Fabrique un trajet correct et l'impose comme trajet de référence. */
function programRoute(game: Phaser.Game): string {
  const ctx = devContext(game)
  if (!ctx) return 'Le potager n’est pas ouvert'

  const route = planRoute({
    field: ctx.newField(),
    hive: ctx.hive,
    origin: ctx.origin,
    reachRise: ctx.reachRise,
    forageRadius: ctx.forageRadius,
    speed: ctx.speed,
    growthMult: ctx.growthMult,
  })
  if (!route) return 'Aucun trajet trouvé'

  ctx.applyRoute(route)
  const rate = ((route.nectar * 1000) / route.duration).toFixed(1)
  return `Trajet posé : ${route.nectar} nectar en ${(route.duration / 1000).toFixed(1)} s (${rate}/s)`
}
