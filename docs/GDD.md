# Let Them Bee — Game Design Document

> **Document vivant.** Il décrit le jeu **tel qu'il est**, pas tel qu'il fut imaginé.
> Toute modification de gameplay doit être répercutée ici dans le même changement
> (cf. `CLAUDE.md`). Les valeurs chiffrées ne sont jamais recopiées : elles vivent
> dans `src/config/` et ce document dit **pourquoi** elles sont là.

|               |                                                               |
| ------------- | ------------------------------------------------------------- |
| Titre         | **Let Them Bee**                                              |
| Version       | `0.1.0` (`package.json`, injectée dans `GAME.version`)        |
| Jam           | DTJ36-28 — thème _abeille_                                    |
| Genre         | Incrémental à **skill** — le pilotage accélère la progression |
| Plateforme    | Navigateur (GitHub Pages + itch.io)                           |
| Stack         | Phaser 4 + `phaser-pixui` + Vite + TypeScript                 |
| Résolution    | 960 × 540, mise à l'échelle `FIT` (layout non responsive)     |
| Langue du jeu | Anglais (`src/config/strings.ts`) — code et docs en français  |

---

## 1. Pitch

Vous avez une ruche, un pré, et **une** butineuse. Vous la pilotez à la souris
pour un seul tour : ruche → corolles → ruche. Ce tour est enregistré, puis
**rejoué en boucle, sans vous, indéfiniment**. Le nectar rentre tout seul ; vous
le dépensez pour bâtir votre rayon, alvéole par alvéole. Et quand la ruche a
grandi, vous reprenez les commandes pour voler un tour meilleur.

## 2. Piliers de design

1. **Le pilotage n'est pas le jeu — c'est ce qu'on optimise.**
   Un incrémental ordinaire achète des chiffres. Ici, l'unité de progression est
   un _geste_ : un trajet volé une fois, jugé, puis automatisé. Le joueur habile
   progresse plus vite, mais personne n'est condamné à jouer à l'adresse en
   permanence.
2. **Comparer doit avoir un sens.**
   Deux trajets ne sont comparables que sur un terrain identique. Le pré est donc
   **rigoureusement déterministe** (§4.3) et le critère est **unique** : nectar par
   seconde. Pas de score composite, pas de chance.
3. **Le timing paie, la vitesse ne sauve pas.**
   Le nectar d'une corolle décroît dès son ouverture. Un tour est bon parce qu'il
   _arrive au bon moment_, pas parce qu'il passe partout.
4. **Ne montrer que le bord de ce qu'on connaît.**
   Castes : celles possédées **+ 1**. Rayon : les alvéoles qui touchent du
   construit. Le joueur ne voit jamais la carte entière.
5. **Rien d'escamoté.**
   Réserve pleine, tour trop court, tour plus lent que le meilleur : le jeu le
   dit, à l'endroit où ça se passe.

## 3. Boucle de jeu

```
                    ┌──────────────────────────────────────────┐
                    ▼                                          │
   [ pré en RELECTURE ]  ──►  nectar dans la réserve  ──►  achat d'alvéoles
     le meilleur tour               (plafonnée)            (Le Rayon, en nectar)
     rejoué en boucle                                             │
            ▲                                                     │
            │                              réserve ↑, vol ↑, pousse ↑, butineuses ↑
            │                                                     │
     nouveau meilleur tour  ◄── comparaison nectar/s ◄── [ ENREGISTREMENT ] ◄─┘
                                                          ≤ 10 s, piloté
```

- **Macro (minutes)** : la ruche produit seule, le joueur dépense et déverrouille.
- **Micro (10 s)** : un enregistrement — la seule séquence où le joueur pilote.
- **Sortie de boucle** : le rayon complet, ou le prestige (§7.4, _non implémenté_).

### 3.1 Les trois modes du pré (`GameScene`, type `Mode`)

| Mode        | Ce qui se passe                                                                 | Pourquoi                                                                       |
| ----------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `idle`      | Aucun trajet connu. La butineuse attend à côté de la ruche, **rien ne rentre**. | Le vide est le tutoriel : il faut enregistrer pour que le jeu démarre.         |
| `replay`    | Le meilleur tour est rejoué en boucle et **récolte pour de vrai**.              | État normal du jeu. Ce n'est pas une animation par-dessus un gain forfaitaire. |
| `recording` | Le joueur pilote. **Banc d'essai** : rien n'entre dans la ruche.                | Un essai ne doit ni enrichir ni être faussé par le plafond de réserve.         |

## 4. Le pré

### 4.1 Emprise

Le mini-jeu de vol est **confiné** à `SCREEN.field` (~38 % de l'écran, cadre
liseré + équerres d'angle). L'essentiel de l'écran appartient à la ruche : le
jeu est un incrémental, le vol en est le moteur, pas le sujet.

La cible de l'abeille est bornée au pré moins une marge : le pointeur peut aller
survoler l'UI sans que la butineuse s'échappe.

### 4.2 Cycle d'une fleur

`bud` (pousse) → `bloom` (floraison) → `gone` (fanée) → repos → repousse.

- Le nectar est **maximal à l'ouverture** et décroît linéairement avec la
  _fraîcheur_ jusqu'à un plancher de 1. Arriver tôt est tout l'enjeu.
- Au-dessus d'un seuil de fraîcheur, la récolte est **« Perfect »** et double.
- Une fleur butinée est **épuisée jusqu'à la fin de sa floraison**, puis reprend
  son cycle **à l'heure prévue** : récolter ne décale jamais le calendrier.

### 4.3 Déterminisme (règle absolue)

L'état d'un emplacement est une **fonction pure du temps écoulé depuis le début
du tour**. Rien ne s'accumule, rien ne dérive ; `FlowerField.reset()` suffit à
retrouver le pré à la milliseconde. Positions et décalages initiaux sont tirés
une fois avec une graine fixe (`FLOWER.seed`).

Conséquence : le pré est remis à zéro **au début de chaque enregistrement** et
**à chaque bouclage de la relecture**. Deux tours voient exactement les mêmes
fleurs aux mêmes secondes — sinon on comparerait de la chance.

### 4.4 Espèces

Huit espèces (`FLOWER_KINDS`, l'index **est** la colonne de la planche Tiny
Garden). Chacune a son rythme : **les plus voyantes sont les plus lentes à venir
et les plus brèves, mais paient beaucoup mieux** (marguerite ×1 / orchidée ×3,5).
La couleur annonce le comportement — le joueur apprend le pré à l'œil.

Une fleur **ne repousse jamais à l'identique** : l'espèce du cycle _n_ d'un
emplacement est un mélange de bits de sa graine (imprévisible à l'œil, totalement
reproductible). Sans ça, le terrain s'apprendrait une fois pour toutes et le tour
optimal se figerait.

## 5. Le trajet enregistré

### 5.1 Format

Positions échantillonnées **à pas fixe**, relatives au coin haut-gauche du pré et
arrondies au pixel : pas besoin de stocker le temps, le trajet survit à un
déplacement du pré, et la sauvegarde reste compacte.

### 5.2 Enregistrer

- Départ propre : abeille à la ruche, sacoche vide, pré remis à zéro.
- **Couperet de 10 s** : le tour se clôt en l'état, rentré ou pas. Un tour rejoué
  en boucle _doit_ être court — dix secondes bien remplies valent mieux qu'une
  minute de promenade. Le compteur passe au rouge dans les deux dernières.
- Rentrer à la ruche avec du nectar **clôt le tour, toujours** — et le tour est
  jugé sur-le-champ. Un tour très court n'est pas un tour invalide : le critère
  étant le nectar par seconde, une boucle d'une seconde bien remplie est même le
  meilleur des cas. Et un tour battu se solde quand même par un verdict, sinon le
  joueur reste en vol sans savoir que sa boucle est déjà jugée.
- Seul le tour **bredouille** doit durer un minimum pour compter (« too short ») :
  faute de quoi un aller-retour vide s'installerait comme premier trajet de
  référence, puisque le premier tour gagne toujours.
- Le bouton permet d'abandonner à tout moment.

### 5.3 Juger

**Un seul critère : le nectar par seconde.** Un tour plus long peut donc gagner
s'il récolte assez. Le premier tour gagne toujours. Verdicts affichés : _New best
run!_ / _Slower than your best_ / _Time's up_.

### 5.4 Rejouer

La butineuse suit le trajet **au pixel, sans inertie** : avec, elle couperait les
virages et manquerait les corolles qu'elle visait. Chaque bouclage remet le pré à
zéro et solde le nectar encore porté.

L'inertie n'existe donc **que pendant l'enregistrement** — c'est la difficulté du
geste, et elle est ce qui rend un bon trajet méritant.

### 5.5 Les butineuses supplémentaires

Chaque butineuse au-delà de la première multiplie la récolte du tour **sans être
dessinée**. Une seule abeille à l'écran reste lisible, et toutes volent par
définition le même tour de référence.

## 6. Économie

| Ressource        | Origine                                              | Usage                                                           | Plafond                |
| ---------------- | ---------------------------------------------------- | --------------------------------------------------------------- | ---------------------- |
| **Nectar**       | Récolté par la butineuse, versé à la ruche           | **Toutes** les alvéoles du rayon, puis la transformation (§6.2) | Oui — `nectarCapacity` |
| **Miel**         | **Transformé** du nectar par les ouvrières, par lots | Monnaie de la colonie : castes, prestige                        | Non                    |
| **Gelée royale** | Une dose tous les `jellyThreshold` de miel gagné     | Prestige (§7.4)                                                 | Non                    |

**Pourquoi le rayon se paie en nectar.** Le miel est l'affaire de la colonie ; le
rayon est l'affaire de la butineuse. Son prix se lit dans la seule ressource
qu'un bon trajet fait monter — améliorer son vol se paie en volant.

**Le plafond de nectar est la vraie horloge du jeu.** La sacoche de la butineuse,
elle, est **illimitée** : un plafond de sacoche se traduisait à l'écran par des
corolles survolées sans effet et sans explication. Le stock, lui, est lisible en
haut de l'écran — et il se débloque dans le rayon. Quand il déborde, le jeu
l'annonce (« Full! »), sur la ruche ou sur la fleur concernée.

### 6.1 La transformation (`HONEY`)

**Rien ne se crée dans cette ruche.** Le miel ne tombe plus du ciel : les
ouvrières le tirent du nectar de la réserve. Une caste qui produisait « 0,5 par
seconde » à partir de rien faisait de la moitié du jeu un décor — le nectar
rapporté ne servait qu'au rayon, et une fois le rayon bâti, plus rien ne
justifiait de voler.

Le miel se fabrique donc par **lots**, et un lot est un **engagement** :

- il coûte `nectarPerBatch` **à l'allumage**, pas à l'arrivée. La réserve tombe
  d'un coup, en haut de l'écran — le joueur voit ce qu'il paie ;
- sous ce montant, rien ne démarre, et la transformation **repart d'elle-même**
  dès que la réserve repasse le seuil. Pas de bouton « lancer » : l'attente,
  c'est le nectar qui manque, et le joueur sait déjà comment en avoir ;
- il dure `batchMs` et rend `honeyPerWorker` **par ouvrière**. La quantité est
  minuscule devant les 100 nectar dépensés : le miel n'est pas du nectar
  converti, c'est une ressource d'un autre ordre, et son prix se compte en
  réserves entières.

La **gelée royale** n'a plus de taux continu : une dose (`jellyPerThreshold`)
se dépose tous les `jellyThreshold` de miel gagné, reliquat conservé. Un
événement rare et visible plutôt qu'une décimale qui bouge.

**L'interrupteur.** La transformation mord sur la réserve, or une réserve qui ne
monte plus ne paie plus les alvéoles de rang IV — le premier lot priverait à
jamais le joueur de ce qu'il n'a pas encore acheté. On peut donc couper et
relancer la transformation. C'est le seul réglage manuel du jeu, et il existe
uniquement pour que rien ne devienne inatteignable (cf. la règle d'équilibrage de
§7.3).

Couper, c'est couper **tout de suite** : le lot en cours est abandonné et son
nectar rendu à la réserve, dans la limite du plafond. Laisser le lot finir
trahirait le geste — on coupe justement parce qu'on a besoin de ce nectar, et
faire attendre huit secondes pour qu'une décision prenne effet, c'est répondre
non. Le rendu écrêté est le prix d'une réserve déjà pleine, pas une punition.

Il a **deux commandes pour un seul état** : un clic sur la jauge, qui est le
geste direct — on coupe là où on voit tourner — et un bouton dans le panneau
**Colonie**, qui est le geste qu'on trouve. Une jauge cliquable ne dit pas
qu'elle l'est ; le panneau des effectifs, si.

Ce bouton est **sur la ligne des ouvrières**, pas au bas du panneau : au bas, il
commanderait « la colonie », alors qu'on n'endort que les ouvrières — la
butineuse, elle, vole toujours. Sur leur ligne, sa portée se lit sans phrase. Il
n'apparaît qu'avec la première ouvrière et nomme l'action à venir, pas l'état
courant (« Rest » / « Brew ») ; l'état, lui, se dit à côté de l'effectif par un
**Zzz** posé, suivi de points qui respirent — le mot ne clignote pas, il doit se
lire ; ce sont les points qui font le sommeil. C'est cet état qu'on cherche quand
on se demande pourquoi le miel ne monte plus, et un libellé de bouton ne le
donne pas.

La jauge, elle, prend la **main gravée du jeu** au survol, comme tout ce qui se
clique ici — pas la main du navigateur : une seule main à l'écran.

### 6.2 Castes (`BEE_KINDS`, l'ordre fait foi)

| Caste       | Rôle                                                            | Statut                                                                      |
| ----------- | --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Forager** | L'abeille que l'on pilote. Ne produit rien seule.               | Effectif porté par la branche `foragers` du rayon                           |
| **Worker**  | Ne quitte jamais la ruche, transforme le nectar en miel (§6.1). | Donnée par la branche `workers` du rayon ; **achat au miel non implémenté** |
| **Warrior** | Garde l'entrée.                                                 | Coquille : aucun effet, non achetable                                       |

Le panneau _Colony_ affiche les castes possédées **+ la suivante**
(`visibleKinds`) : au premier lancement, butineuse et ouvrière ; la guerrière
n'existe pas encore aux yeux du joueur.

## 7. Le Rayon (arbre d'améliorations)

### 7.1 Forme

Il n'y a pas de « nœud à trois niveaux » : **chaque niveau est une alvéole**,
collée contre la précédente, en coordonnées axiales (hexagones pointe en haut).
L'alvéole `(0,0)` est la ruche : elle ne s'achète pas, elle **amorce** le rayon.
On ne monte pas un niveau, on colle une cire de plus au bord — c'est ce qui fait
du rayon une ruche qui s'étend plutôt qu'une liste de compteurs.

Les branches partent de quatre voisines de la ruche puis **s'incurvent** : quatre
rayons droits auraient fait une étoile, pas un rayon de miel.

### 7.2 Dévoilement

Une alvéole n'apparaît que si elle **touche du construit** (la ruche, ou une
alvéole payée). Acheter une case ouvre ses voisines, et rien d'autre. Une alvéole
s'achète **une fois, et pour de bon**.

### 7.3 Les cinq branches

| Branche      | Effet d'une alvéole                                       | Forme                                        | Intention                                                                               |
| ------------ | --------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Storage**  | + un palier de réserve de nectar                          | 4 alvéoles, vers le haut                     | Le déverrouilleur : c'est elle qui rend le reste payable                                |
| **Foragers** | +1 butineuse sur le trajet                                | 1 alvéole, à droite                          | Le doublement sec — la récompense la plus lisible                                       |
| **Flight**   | Vitesse de vol, **très** légèrement                       | 4 alvéoles, vers le bas                      | Assez pour raser un virage, jamais pour voler le tour à votre place                     |
| **Growth**   | Accélère le calendrier du pré                             | 4 alvéoles, vers la gauche                   | Les fleurs reviennent plus tôt : un tour croise plus de corolles ouvertes               |
| **Workers**  | Donne la première ouvrière, donc la transformation (§6.1) | 1 alvéole, **au bout de la branche Storage** | Le basculement du jeu : jusque-là le nectar s'améliore, à partir de là il se transforme |

**Pourquoi l'alvéole des ouvrières est là et pas ailleurs.** Elle est la plus
chère du rayon (la réserve pleine à vingt nectar près) et n'est **visible**
qu'une fois les quatre paliers de réserve bâtis. Deux raisons : c'est la seule
place où un tel prix est payable, et l'ordre d'apprentissage y gagne — on
n'ouvre le second métier de la ruche qu'après avoir compris le premier.
L'alvéole ne déverrouille pas un achat, elle **donne** l'ouvrière : le miel
n'existe pas encore pour la payer.

**Règle d'équilibrage structurante.** Tout se paie en nectar, or le nectar est
plafonné : une alvéole plus chère que la réserve du moment est **inatteignable à
jamais** — le joueur butine et la réserve sature avant le prix. D'où :

- la branche _Storage_ reste toujours payable sous le plafond courant : c'est
  elle qui ouvre tout le reste ;
- les rangs III demandent deux paliers de réserve, les rangs IV les quatre. Ce
  n'est pas un cul-de-sac, c'est un **ordre** : on agrandit sa ruche avant de
  s'offrir le luxe.
- **Toute nouvelle alvéole doit tenir sous le plafond maximal** (réserve
  complète), sinon elle est inachetable pour toujours. Vérifier `UPGRADE_EFFECT.
storageStep` avant d'ajouter un prix.

### 7.4 Prestige — _conçu, non implémenté_

La gelée royale nourrit la reine suivante : reset de la partie contre un arbre de
reines permanent. `queens` et `royalJelly` sont persistés et accumulés, mais
aucune interface ne les dépense. **C'est le plus gros manque de design actif.**

## 8. Écrans & interface

| Scène   | Contenu                                                                                                                                                              |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Boot`  | Chargement, cuisson des textures procédurales et du fond de prairie                                                                                                  |
| `Title` | Logo animé, jardin en tileset, boutons _New Game_ / _Continue_, pop-up crédits, panneau de réglages (volumes), pied de page (version, crédit jam, liens itch/GitHub) |
| `Game`  | Barre de ressources · panneau _Colony_ · bouton du Rayon · le pré · bandeau d'état                                                                                   |
| `Comb`  | Le Rayon. **Scène** superposée, pas pop-up (voir ci-dessous)                                                                                                         |
| `Pause` | Échap, en surimpression : reprendre, réglages, retour au titre                                                                                                       |

**Découpe de l'écran de jeu** (`SCREEN`, coordonnées absolues) : barre de
ressources en haut ; à gauche la colonne _Colony_ surmontant le bouton du Rayon ;
à droite le pré, surmontant le bandeau d'état.

**Le bandeau d'état** est le poste de commande du trajet : message / consigne /
verdict, le bilan du meilleur tour (durée, nectar, **nectar/s**) en trois cases
côte à côte, le compte à rebours (visible **uniquement** pendant un
enregistrement — un cadran mort ne dit rien à personne) et le bouton.

Deux règles de dévoilement s'y appliquent, pour la même raison — **rien à
l'écran ne doit rester affiché après avoir cessé de parler** :

- **Le bilan ne s'affiche qu'à partir du premier tour.** Tant qu'il n'y en a
  pas, sa case porte à la place l'**appel à l'action** (« dessinez un chemin de
  nectar, de fleur en fleur, et rentrez à la ruche »). Trois tirets sous trois
  libellés forment un tableau vide, là où le joueur a précisément besoin qu'on
  lui dise quoi faire. L'appel à l'action se tait aussi **pendant**
  l'enregistrement : le joueur est en train de faire ce qu'on lui demande, et le
  bouton dit désormais « Give up ».
- **Le verdict d'un tour est transitoire** (`HUD.verdictMs`). « New best run! »
  s'efface au profit de la consigne permanente : passé quelques secondes, il ne
  parle plus du tour que le joueur a en tête, et rien ne le distingue d'une
  consigne.

**Le Rayon** occupe **l'union exacte des quatre cadres du bas** et se présente
comme un cadre de plus, du même bois : regarder sa ruche est une activité du jeu,
pas une parenthèse. Le pré continue de tourner dessous ; seules ses entrées sont
coupées, pour que le glissé du rayon ne pilote pas l'abeille. Le rayon se
déplace au glissé (un glissé n'achète rien) et la barre de ressources reste
découverte au-dessus : le joueur doit voir sa réserve fondre à l'achat.

**La jauge de transformation** coiffe **le toit de la ruche**, dans le pré, et
pas dans la barre du haut : le miel est une affaire de ruche, et le joueur doit
faire le lien entre la réserve qui tombe et le pot qui monte. Elle est
**horizontale**, large comme le toit, et se remplit de gauche à droite — elle se
lit d'un coup d'œil sans quitter l'abeille des yeux. Trois états lisibles
d'emblée : elle n'existe pas tant qu'il n'y a pas d'ouvrière, son liseré s'éteint
quand rien ne transforme (coupée, ou faute de nectar), il s'allume quand un lot
est en cours. À l'arrivée du lot, le gain sort **juste au-dessus**, avec son
pot : `+0.25`
pour le miel, `+0.5` plus haut pour la gelée royale quand elle tombe. Un nombre
nu ne dirait pas de quelle ressource il parle — et les deux tombent au même
endroit, à quelques lots d'écart.

**Le bouton du Rayon** bat quand une alvéole est payable.

**Les relances (« nudges »)** sont les seuls appels à l'action non sollicités du
jeu, et le jeu n'en montre une que lorsque le joueur n'a **aucun moyen de
deviner** le geste attendu. Une flèche ambrée qui va et vient — immobile, elle
se confondrait avec le décor — désigne alors le bouton concerné :

| Relance                                | Condition                                               | S'éteint                   |
| -------------------------------------- | ------------------------------------------------------- | -------------------------- |
| Flèche sur _Record a run_              | aucun tour enregistré, et pas d'enregistrement en cours | au premier tour enregistré |
| Flèche + « New upgrade! » sur le Rayon | une alvéole payable **et aucune encore bâtie**          | au premier achat           |

La relance du Rayon ne vise **que le premier achat** : ensuite le joueur sait où
est le rayon, et le battement de la ruche reprend seul le relais pour toutes les
alvéoles suivantes.

**Infobulles** au survol de tout ce qui porte un nom : ressources, castes,
alvéoles.

## 9. Direction artistique & audio

- **Palette** : cinq couleurs, fixées dans `CLAUDE.md` et `PALETTE`
  (`src/ui/theme.ts`). Toute nouvelle couleur doit en être tirée. Une seule
  exception assumée : le **rouge d'alerte** du compte à rebours — c'est une
  alarme, elle doit jurer. (Des teintes historiques hors palette subsistent dans
  `COLORS` et `gfx/textures.ts` : à migrer, cf. PROGRESS.md.)
- **Pixel-perfect** : échelles **entières** pour tout le pixel art (fleurs ×2,
  abeille ×0,5 sur une texture bakée à 2 points/pixel), tailles de police
  multiples de la cellule de 12 px, position de l'abeille **calée sur la grille**
  (sa position réelle reste flottante, sinon elle resterait plantée).
- **Orientation de l'abeille** : 16 caps discrets, pas de rotation libre — une
  rotation continue rééchantillonnerait le dessin en permanence.
- **Séparation moteur / skin** : `src/config/*` (moteur, aucune valeur en dur
  ailleurs) vs `src/ui/theme.ts` (skin remplaçable d'un bloc).
- **Audio** : musique de titre et de potager en fondu croisé, son de clic UI,
  volumes musique/SFX persistés. Manquent les SFX de gameplay (butinage, dépôt,
  Perfect).
- **Crédits** : tout asset entre dans `CREDITS` (`strings.ts`) **en même temps
  que l'asset**, avec auteur et licence.

## 10. Sauvegarde

localStorage, autosave périodique. Persistés : nectar, miel, gelée royale,
effectifs, meilleur miel, reines, identifiants d'alvéoles, meilleur trajet, et
l'état de la transformation (lot en cours et son avancement, reliquat de miel
vers la gelée royale, interrupteur). Le nectar d'un lot engagé a déjà quitté la
réserve : on reprend le lot où il en était plutôt que de le perdre.

Deux garde-fous à la relecture : une alvéole dont l'identifiant a disparu du
rayon n'est pas ressuscitée, et un trajet tronqué est écarté plutôt que rejoué de
travers.

> ⚠️ **La sauvegarde est actuellement désactivée** (`GAME.saveEnabled = false`),
> le temps de travailler l'écran d'accueil : chaque lancement se présente comme
> celui d'un nouveau joueur. À réactiver avant la sortie.

## 11. Outils de développement

Chargés **uniquement** derrière `import.meta.env.DEV`, donc absents du build de
production. Du DOM ordinaire dans la police système : ce n'est pas de l'interface
de jeu et ça ne doit surtout pas y ressembler.

- **Menu de triche** (`Tab`) : donner/retirer des ressources, posséder des
  alvéoles.
- **Vitesse du jeu** (x1 / x2 / x4, dans le menu) : multiplie le `delta` de la
  scène de jeu en un seul point, avant tout calcul — un lot de miel de 8 s ou une
  repousse de fleur ne s'observe pas en temps réel. Des radios, parce que c'est un
  état : le menu doit dire à quelle vitesse tourne le jeu. Retour à x1 dès que la
  scène est recréée.
- **`planRoute`** : fabrique un trajet correct par simulation (le pré est pur, on
  peut donc le lire dans le futur), imposé sans être comparé au meilleur.
- En dev, le jeu est exposé sur `window.__game`.

## 12. État d'implémentation

**Fait** — pré déterministe et ses huit espèces · enregistrement / jugement /
relecture du trajet · nectar plafonné · le Rayon (5 branches, dévoilement,
achats) · transformation du nectar en miel par lots, sa jauge et ses gains
flottants · gelée royale par paliers · HUD complet et infobulles · relances de
première fois (trajet, rayon) et dévoilement du bandeau · écran-titre complet,
transitions, audio, pause · déploiements Pages + itch.

**Manquant, par ordre d'impact design**

1. **Prestige** — gelée royale et reines accumulées mais indépensables : le jeu
   n'a pas de fin.
2. **Achat de castes** — la première ouvrière s'obtient au rayon, mais rien ne
   permet d'en recruter une seconde. Le miel n'a donc toujours **aucun usage** :
   il se produit et s'accumule, sa seule sortie est la gelée royale.
3. **Anneau de timing « Perfect »** — la mécanique est le cœur du skill et n'a
   aucun retour visuel autour de la corolle.
4. SFX de gameplay ; sprites abeille/fleur/ruche encore procéduraux ; migration
   des couleurs historiques vers la palette.

## 13. Décisions de design écartées (et pourquoi)

| Écarté                                                                   | Raison                                                                                                                                                                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Combo / multiplicateur d'enchaînement** (`systems/Combo.ts`, supprimé) | Récompensait le pilotage en direct, alors que le jeu automatise le pilotage. Le trajet, jugé au nectar/s, joue ce rôle mieux et une seule fois.                                                  |
| **Plafond de sacoche sur la butineuse**                                  | Se traduisait par des corolles survolées sans effet ni explication. Le plafond est passé à la **ruche**, où il est lisible et améliorable.                                                       |
| **Améliorations de vol généreuses**                                      | Rendre le pilotage facile viderait l'enregistrement de son intérêt. Le gain est volontairement minuscule.                                                                                        |
| **Rayon en pop-up**                                                      | Une parenthèse modale disait « le jeu s'arrête ». Le rayon est un cadre de l'écran de jeu, et le pré tourne dessous.                                                                             |
| **Production de miel passive** (0,5/s/ouvrière, sans intrant)            | Du miel créé à partir de rien : le nectar rapporté ne servait qu'au rayon, et une fois le rayon bâti plus rien ne justifiait de voler. Le miel se transforme désormais depuis la réserve (§6.1). |
| **Taux continu de gelée royale** (0,05 % du miel gagné)                  | Une décimale qui bouge n'est pas un événement. Remplacé par une dose franche tous les 50 miel, annoncée au-dessus de la ruche.                                                                   |
| **Bilan chiffré en bas de colonne** (production, record, reines)         | Trois nombres inertes que personne ne lisait. Remplacés par la porte du Rayon. Le bilan reviendra quand il aura quelque chose à dire.                                                            |

---

## Annexe — où sont les chiffres

| Fichier                  | Contenu                                                          |
| ------------------------ | ---------------------------------------------------------------- |
| `src/config/balance.ts`  | Abeille, ruche, fleurs et espèces, trajet, économie, castes      |
| `src/config/upgrades.ts` | Alvéoles du rayon (position, prix, monnaie) et effets par niveau |
| `src/config/feel.ts`     | Timings d'entités (battement d'ailes, respiration, autosave)     |
| `src/config/game.ts`     | Version, nom, clé de sauvegarde, dimensions du monde             |
| `src/config/strings.ts`  | Textes EN, infobulles, `CREDITS`                                 |
| `src/ui/theme.ts`        | Palette, polices, découpe de l'écran, feedbacks                  |
