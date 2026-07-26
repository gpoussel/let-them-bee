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
  /** Ligne de stats de l'écran-titre : des libellés courts, sans pluriel à accorder. */
  bees: 'Bees',
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
  /** Achat groupé du rayon, débloqué par la lignée (cf. config/lineage). */
  buyAll: 'Buy all',

  // --- La lignée (arbre de prestige, cf. config/lineage) -------------------
  lineage: "Queen's Lineage",
  /** Le nœud déjà acquis : il ne s'achète plus, il se transmet. */
  lineageOwned: 'Bred',
  /** Jauge de l'arbre. `{n}` acquis sur `{t}` : un compteur nu ne dirait pas de quoi. */
  lineageCount: '{n} of {t} traits bred',
  /** Bourse de l'écran : la gelée qu'il reste à poser. `{n}` : la réserve. */
  lineagePurse: '{n} to spend',
  /** L'essaimage lui-même : le geste qui remet la colonie à zéro. */
  swarm: 'Leave the hive',
  /** Ce que coûte l'essaimage, sous le bouton. Il coûte TOUT sauf le patrimoine. */
  swarmWarn: 'The hive, the comb and your run are lost. The jelly and the lineage are not.',
  /** Deuxième clic : l'essaimage ne part pas sur un geste de travers. */
  swarmConfirm: 'Click again to leave',
  /** Pourquoi rien ne s'achète tant qu'aucune reine n'est partie. */
  lineageLocked:
    'The lineage answers to queens only. Leave the hive once, and the jelly is yours to spend — then and ever after.',
  /** Consigne de l'arbre ouvert et dépensable. */
  lineageSpend: 'Pick what your daughters are born knowing.',
  /** Rien à acheter faute de gelée : d'où elle vient. */
  lineagePoor: 'A drop of royal jelly settles out of every 50 honey. Come back with one.',
  /** Nœud trop cher. `{c}` son prix, `{n}` la réserve. */
  lineageTooDear: 'Costs {c} — you hold {n}.',
  /** Nœud dont le palier précédent manque. */
  lineageNeedsTier: 'The tier before it comes first.',
  /** Relance de la lignée, à côté de la gelée royale (cf. ui/ResourceBar). */
  lineageOffer: 'The lineage is listening.',
} as const

/** Nom, effet et infobulle de chaque alvéole (clés : `UpgradeId`). */
export const UPGRADE_STR: Record<string, { name: string; tip: string }> = {
  storage: {
    name: 'Storage',
    tip: 'A wider comb. The hive holds more nectar before it starts spilling — and each cell widens it more than the last.',
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

/** Nom et infobulle de chaque branche de la lignée (clés : `LineageKind`). */
export const LINEAGE_STR: Record<string, { name: string; tip: string }> = {
  nectarBlood: {
    name: 'Nectar Blood',
    tip: 'Your daughters are born knowing the flight. Every nectar cell of the comb up to this tier stands built on the first morning - the same cells, only sooner.',
  },
  honeyBlood: {
    name: 'Honey Blood',
    tip: 'Your daughters are born knowing the hive. Every honey cell of the comb up to this tier stands built on the first morning: workers, fanning, thrift, ripening.',
  },
  busyWax: {
    name: 'Busy Wax',
    tip: 'A Buy all button appears on the comb. Every cell you can afford is built in one gesture - you have laid this wax before.',
  },
  wideMeadow: {
    name: 'Wide Meadow',
    tip: 'One more flower takes root out there, for good. The same lap meets more corollas without taking a second longer.',
  },
  richBloom: {
    name: 'Rich Bloom',
    tip: 'Every corolla in the meadow opens a tenth richer. It changes no timing and no route: the same flowers simply pay more.',
  },
  quickRoots: {
    name: 'Quick Roots',
    tip: 'A wilted flower rests less before it climbs back up. The meadow turns over faster, so a lap finds fewer bare stems.',
  },
  steadyWings: {
    name: 'Steady Wings',
    tip: 'The bee carries a touch less weight while you fly her. A tight corner comes a little easier - a touch, and no more: the lap is still yours to fly.',
  },
  longDays: {
    name: 'Long Days',
    tip: 'The lap timer falls one second later. A longer lap wins nothing by itself - it is still judged on nectar per second - but it leaves room for one more flower.',
  },
  keenEye: {
    name: 'Keen Eye',
    tip: 'You read a corolla a little better. The window for a Perfect harvest, and its double yield, opens slightly wider.',
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
    tip: "Royal jelly, rare and precious. A drop settles out of every 50 honey. It is the only thing a colony leaves behind: it buys the Queen's Lineage, and it is spent by starting over.",
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
  { label: 'UI sounds', value: 'Universal UI Soundpack - Nathan Gibson (CC BY 4.0)' },
  { label: 'Game SFX', value: 'Essentials Series - Nox Sound Design' },
  { label: 'Engine', value: 'Phaser 4 + Vite + phaser-pixui' },
] as const
