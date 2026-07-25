// Textes UI centralisés (EN). Réutilisables pour la page itch / localisation future.

export const STR = {
  title: 'Let Them Bee',
  tagline: 'Forage, combo, grow your hive.',
  play: 'Forage',
  continue: 'Continue',
  reset: 'Restart',
  soundOn: 'Sound: on',
  soundOff: 'Sound: off',
  honey: 'Honey',
  royalJelly: 'Royal jelly',
  nectar: 'Nectar',
  combo: 'Combo',
  perfect: 'Perfect!',
  hive: 'Hive',
  best: 'Best',
  queens: 'Queens',
  jamCredit: 'Made for #DTJ36-28',
  jamUrl: 'https://itch.io/jam/dtj36-28',
  controlsHint: 'Guide the bee with your mouse. Hover open flowers to forage.',
  itchUrl: 'https://gpoussel.itch.io/let-them-bee',
  githubUrl: 'https://github.com/gpoussel/let-them-bee',
  about: 'Credits',
  close: 'Close',
} as const

// Contenu de la pop-up « about ». Une entrée = une ligne (label + valeur) ;
// value seul = ligne pleine largeur.
export const CREDITS: ReadonlyArray<{ label?: string; value: string }> = [
  { label: 'Author', value: 'Guillaume Poussel (gpoussel)' },
  { label: 'Code & art', value: 'Original pixel art, made for the jam' },
  { label: 'Font', value: 'monogram - Vinicius Menezio (CC0)' },
  { label: 'Cursors', value: 'Cozyland UI - RoleyMoth (roleymoth.itch.io)' },
  { label: 'Engine', value: 'Phaser 4 + Vite + phaser-pixui' },
] as const
