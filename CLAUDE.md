# Let Them Bee — conventions du projet

## Palette

La palette du jeu est fixée à ces 5 couleurs. Toute nouvelle couleur (sprite,
UI, fond, texte) doit en être tirée — pas de teinte ad hoc.

| Hex       | Usage indicatif          |
| --------- | ------------------------ |
| `#71653F` | brun olive (ombres, bois) |
| `#D6DC53` | jaune-vert clair         |
| `#F3B468` | ambre / miel             |
| `#639B35` | vert prairie             |
| `#4A655A` | vert-gris sombre         |

## Crédits

Tout asset utilisé dans le jeu (audio, musique, SFX, éléments d'UI, sprites,
tilesets, fontes…) doit être ajouté aux crédits, avec son auteur et sa licence.

Les crédits sont affichés dans la pop-up « about » de l'écran-titre ; leur
contenu est la liste `CREDITS` dans `src/config/strings.ts`. Ajouter l'entrée
en même temps que l'asset, pas après coup.
