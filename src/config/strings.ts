// Textes UI centralisés (EN). Réutilisables pour la page itch / localisation future.

export const STR = {
  title: 'Let Them Bee',
  play: 'New Game',
  continue: 'Continue',
  reset: 'Restart',
  soundOn: 'Sound: on',
  soundOff: 'Sound: off',
  honey: 'Honey',
  royalJelly: 'Royal jelly',
  nectar: 'Nectar',
  perfect: 'Perfect!',
  full: 'Full!',
  hive: 'Hive',
  best: 'Best',
  queens: 'Queens',
  jamCredit: 'Made for #DTJ36-28',
  jamUrl: 'https://itch.io/jam/dtj36-28',
  controlsHint: 'Guide the bee with your mouse. Hover open flowers to forage.',
  record: 'Record a run',
  recordAgain: 'Beat this run',
  stopRecording: 'Give up',
  bestRun: 'Best run',
  /** Appel à l'action affiché À LA PLACE du bilan tant qu'aucun tour n'existe. */
  firstRunTitle: 'No run yet',
  firstRunHint: 'Hit the button, then draw a nectar route: flower to flower, and back to the hive.',
  /** Relance du rayon, tant que le joueur n'a bâti aucune alvéole. */
  combOffer: 'New upgrade!',
  lapTime: 'Lap',
  lapRate: 'Nectar/s',
  noRoute: 'No run recorded yet. Record one and your forager will fly it forever.',
  recordingHint: 'Fly the bee: forage, then come back to the hive. 10 seconds, no more.',
  timeUp: "Time's up - the lap was closed where it stood.",
  newBest: 'New best run!',
  keptOld: 'Slower than your best - run discarded.',
  runTooShort: 'Too short to count.',
  colony: 'Colony',
  /** Interrupteur de la transformation, sur la ligne des ouvrières. */
  workerRest: 'Rest',
  workerBrew: 'Brew',
  /** Ouvrières au repos, à côté de leur effectif. Suivi de points qui respirent. */
  asleep: 'Zzz',
  locked: 'locked',
  perSecond: '/s',
  meadow: 'Meadow',
  carrying: 'Carrying',
  itchUrl: 'https://gpoussel.itch.io/let-them-bee',
  githubUrl: 'https://github.com/gpoussel/let-them-bee',
  about: 'Credits',
  close: 'Close',
  settings: 'Settings',
  musicVolume: 'Music',
  sfxVolume: 'Sound FX',
  done: 'Done',
  backToTitle: 'Back to title',
  comb: 'The Comb',
  combOwned: 'Built',
} as const

/** Nom, effet et infobulle de chaque alvéole (clés : `UpgradeId`). */
export const UPGRADE_STR: Record<string, { name: string; tip: string }> = {
  storage: {
    name: 'Storage',
    tip: 'A wider comb. The hive holds more nectar before it starts spilling.',
  },
  foragers: {
    name: 'Foragers',
    tip: 'One more forager flies your recorded lap alongside the others. More nectar, same run.',
  },
  flight: {
    name: 'Flight',
    tip: 'Slightly faster wings. Enough to shave a corner, not enough to fly the lap for you.',
  },
  workers: {
    name: 'Workers',
    tip: 'One more worker moves into the hive. Workers never fly: they turn stored nectar into honey, one batch at a time, and a batch yields more the more of them there are. Click the bar above the hive to stop or restart it.',
  },
  growth: {
    name: 'Growth',
    tip: 'The meadow runs a little faster. Flowers come back sooner, so a lap meets more of them open.',
  },
  fanning: {
    name: 'Fanning',
    tip: 'Wings beat over the cells. Each batch ripens faster - same nectar in, same honey out, less waiting.',
  },
  thrift: {
    name: 'Thrift',
    tip: 'Not a drop wasted. A batch takes less nectar out of the stores, so the comb and the honey stop fighting over it.',
  },
  ripening: {
    name: 'Ripening',
    tip: 'Honey capped and cured properly. The very same batch yields more of it.',
  },
}

/** Nom et infobulle de chaque caste (clés : `BeeKindId`). */
export const BEE_STR: Record<string, { name: string; tip: string }> = {
  forager: {
    name: 'Forager',
    tip: 'The bee you fly. She gathers nectar from open flowers and brings it home.',
  },
  worker: {
    name: 'Worker',
    tip: 'Never leaves the hive. Takes nectar out of the stores by the batch and turns it into honey, even while you fly.',
  },
  warrior: {
    name: 'Warrior',
    tip: 'Stands guard at the entrance and keeps the raiders out.',
  },
}

/** Nom et infobulle de chaque ressource de la barre du haut. */
export const RESOURCE_STR = {
  nectar: {
    name: STR.nectar,
    tip: 'The nectar your hive holds. It pays for the comb - and, once you have workers, it is what they brew into honey.',
  },
  honey: {
    name: STR.honey,
    tip: 'Honey, the currency of the colony. Brewed from nectar by your workers, one batch at a time - and it pays for the inner comb: more bees, better brewing.',
  },
  royalJelly: {
    name: STR.royalJelly,
    tip: 'Royal jelly, rare and precious. A drop settles out of every 50 honey. It feeds the next queen when you start over.',
  },
} as const

// Contenu de la pop-up « about ». Une entrée = une ligne (label + valeur) ;
// value seul = ligne pleine largeur.
export const CREDITS: readonly { label?: string; value: string }[] = [
  { label: 'Author', value: 'Guillaume Poussel (gpoussel)' },
  { label: 'Code & art', value: 'Original pixel art, made for the jam' },
  { label: 'Font', value: 'monogram - Vinicius Menezio (CC0)' },
  { label: 'UI & cursors', value: 'Cozyland UI - RoleyMoth (roleymoth.itch.io)' },
  { label: 'Garden tiles', value: '16x16 Tiny Garden - kathychow (kathychow.itch.io)' },
  { label: 'Music', value: 'Castle Tales - alkakrab (alkakrab.itch.io)' },
  { label: 'UI sounds', value: 'Universal UI Soundpack - Cyrex Studios' },
  { label: 'Engine', value: 'Phaser 4 + Vite + phaser-pixui' },
] as const
