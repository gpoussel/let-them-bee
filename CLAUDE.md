# Let Them Bee — conventions du projet

## GDD

Le game design document est `docs/GDD.md`. Il décrit le jeu **tel qu'il est**,
pas tel qu'il fut imaginé.

**Tout changement de gameplay doit être répercuté dans le GDD, dans le même
changement** — pas après coup. Sont concernés : une mécanique ajoutée, retirée ou
retournée ; une ressource, une caste, une branche ou une alvéole du rayon ; une
règle d'équilibrage structurante (plafonds, critère de comparaison d'un trajet,
ordre de dévoilement) ; une décision de design écartée (section 13) ; le passage
d'une fonctionnalité de « manquant » à « fait » (section 12).

Un simple retuning de valeurs ne s'y écrit pas : les chiffres vivent dans
`src/config/`, le GDD dit **pourquoi** ils sont là. S'il faut changer un chiffre
et que la raison écrite ne tient plus, c'est la raison qu'on met à jour.

## Style de code

Le formatage et le lint ne se discutent pas : ils sont outillés.

- **Prettier** (`.prettierrc.json`) : pas de point-virgule, guillemets simples,
  100 colonnes, virgule finale partout, fins de ligne LF.
- **ESLint** (`eslint.config.js`) : `typescript-eslint` en `strictTypeChecked` +
  `stylisticTypeChecked`. Zéro warning toléré. Les quelques règles assouplies
  sont commentées dans le fichier — en ajouter une demande une raison écrite au
  même endroit.
- `npm run check` = format + lint + types. C'est ce que vérifie la CI
  (`.github/workflows/ci.yml`), en plus du build.
- Un hook `pre-commit` (husky + lint-staged) formate et lint les fichiers mis en
  scène : du code non conforme ne part pas en commit.
- `npm run format` et `npm run lint:fix` corrigent la plupart des écarts.

## Palette

La palette du jeu est fixée à ces 5 couleurs. Toute nouvelle couleur (sprite,
UI, fond, texte) doit en être tirée — pas de teinte ad hoc.

| Hex       | Usage indicatif           |
| --------- | ------------------------- |
| `#71653F` | brun olive (ombres, bois) |
| `#D6DC53` | jaune-vert clair          |
| `#F3B468` | ambre / miel              |
| `#639B35` | vert prairie              |
| `#4A655A` | vert-gris sombre          |

## Crédits

Tout asset utilisé dans le jeu (audio, musique, SFX, éléments d'UI, sprites,
tilesets, fontes…) doit être ajouté aux crédits, avec son auteur et sa licence.

Les crédits sont affichés dans la pop-up « about » de l'écran-titre ; leur
contenu est la liste `CREDITS` dans `src/config/strings.ts`. Ajouter l'entrée
en même temps que l'asset, pas après coup.
