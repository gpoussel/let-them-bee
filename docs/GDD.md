# Let Them Bee — Game Design Document

> **Document vivant.** Il décrit le jeu **tel qu'il est**, pas tel qu'il fut imaginé.
> Toute modification de gameplay doit être répercutée ici dans le même changement
> (cf. `CLAUDE.md`). Les valeurs chiffrées ne sont jamais recopiées : elles vivent
> dans `src/config/` et ce document dit **pourquoi** elles sont là.

|               |                                                               |
| ------------- | ------------------------------------------------------------- |
| Titre         | **Let Them Bee**                                              |
| Version       | `0.5.0` (`package.json`, injectée dans `GAME.version`)        |
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
     le meilleur tour               (plafonnée)             (le rayon du VOL)
     rejoué en boucle                  │                           │
            ▲                          ▼                           │
            │                  TRANSFORMATION ──► miel ──► achat d'alvéoles
            │                   (les ouvrières)             (le rayon de la RUCHE)
            │                          ▲                           │
            │                          └── ouvrières, lots ◄───────┤
            │                                                      │
            │                              réserve ↑, vol ↑, pousse ↑, butineuses ↑
            │                                                      │
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

| Ressource        | Origine                                              | Usage                                                          | Plafond                |
| ---------------- | ---------------------------------------------------- | -------------------------------------------------------------- | ---------------------- |
| **Nectar**       | Récolté par la butineuse, versé à la ruche           | Le rayon **du vol** (§7.3), puis la transformation (§6.1)      | Oui — `nectarCapacity` |
| **Miel**         | **Transformé** du nectar par les ouvrières, par lots | Le rayon **de la ruche** (§7.3) : effectifs, réglages des lots | Non                    |
| **Gelée royale** | Une dose tous les `jellyThreshold` de miel gagné     | Prestige (§7.4)                                                | Non                    |

**Deux moitiés, deux monnaies.** Le rayon du vol (réserve, vol, pousse, première
butineuse, première ouvrière) se paie en **nectar** : améliorer son vol se paie en
volant, et son prix se lit dans la seule ressource qu'un bon trajet fait monter.
Le rayon de la ruche — tout ce qui règle la transformation et les effectifs — se
paie en **miel**, ce que la ruche produit elle-même.

Ce partage règle le manque le plus criant de la version précédente : le miel se
produisait sans jamais se dépenser. Il a maintenant un débouché, et ce débouché
**boucle** : plus de miel achète plus d'ouvrières et de meilleurs lots, donc plus
de miel ; il achète aussi des butineuses, donc plus de nectar, donc plus de lots.
Le joueur n'attend plus, il choisit dans quel sens investir.

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

**Ces trois nombres sont les trois leviers du rayon de la ruche** (§7.3) : le
coût du lot descend (_Thrift_), sa durée raccourcit (_Fanning_), son rendement
monte (_Ripening_), et l'effectif d'ouvrières multiplie ce rendement. Trois
leviers plutôt qu'un seul « +10 % de miel », parce qu'ils ne se ressemblent pas à
l'usage : l'économie rend du nectar au rayon du vol, la ventilation rend du temps,
la maturation rend du miel. Le rendement est **arrondi au centième**, la précision
qu'affiche le gain flottant — un `+0.31` annoncé pour 0,3125 versé ferait mentir
le compte.

La **gelée royale** n'a plus de taux continu : une dose (`jellyPerThreshold`)
se dépose tous les `jellyThreshold` de miel gagné, reliquat conservé. Un
événement rare et visible plutôt qu'une décimale qui bouge.

**L'interrupteur.** La transformation mord sur la réserve, or une réserve qui ne
monte plus ne paie plus les alvéoles des rangs les plus hauts — le premier lot priverait à
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

| Caste       | Rôle                                                            | Statut                                                           |
| ----------- | --------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Forager** | L'abeille que l'on pilote. Ne produit rien seule.               | Effectif porté par la branche `foragers` du rayon (1 + 1 + 2)    |
| **Worker**  | Ne quitte jamais la ruche, transforme le nectar en miel (§6.1). | Effectif porté par la branche `workers` du rayon (1 + 1 + 1 + 2) |
| **Warrior** | Garde l'entrée.                                                 | Coquille : aucun effet, non achetable                            |

**Les effectifs se recrutent au rayon, pas dans un panneau.** `BEE_KINDS.cost`
existe toujours mais ne sert à rien : un second guichet de recrutement à côté du
rayon aurait fait deux endroits pour une seule décision. Une alvéole ne
déverrouille donc pas un achat, elle **donne** les abeilles (`CombCell.bees`) — et
le panneau _Colony_ reste ce qu'il est, un état, pas une boutique.

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

Une alvéole se dévoile quand **ce qui la précède est bâti**, dans cet ordre :

- son **prérequis explicite** s'il en a un (`CombCell.needs`) ;
- sinon, à partir du **rang 2**, le rang précédent de **sa branche** ;
- sinon, toujours au-delà du rang 1, le contact avec une alvéole bâtie **de sa
  propre branche** ;
- au **rang 1**, le simple contact avec du construit (la ruche, ou une alvéole
  payée) : c'est lui qui amorce une branche.

C'est la **branche** qui fait l'ordre, plus le voisinage toutes branches
confondues. Le rayon s'est épaissi au centre (§7.3) : une alvéole en touche
désormais plusieurs d'autres branches, et au voisinage seul, acheter la
ventilation dévoilerait le troisième palier de réserve.

**Le voisinage de branche**, lui, est là parce que les branches s'incurvent : le
rang V se recolle contre le rang III, et une alvéole qu'on touche du doigt mais
qui n'existe pas encore se lit comme un trou dans la cire. Elle se montre donc
dès que la branche arrive à côté d'elle — quitte à s'acheter **avant** le rang
qui la précède. Ce n'est pas un raccourci : les deux se paient de toute façon, et
le plafond de réserve (§7.4) reste le vrai ordonnanceur. Le prérequis explicite, lui, dit ce que la géométrie ne peut pas dire :
les alvéoles en miel touchent la ruche, elles seraient visibles à la première
seconde, prix en miel affiché, alors que le miel n'existe pas encore. Elles
attendent donc la première ouvrière.

Une alvéole s'achète **une fois, et pour de bon**.

### 7.3 Les huit branches

**Le rayon du vol**, payé en nectar, part de quatre voisines de la ruche :

| Branche      | Effet d'une alvéole                               | Forme                                                                   | Intention                                                                                                                                               |
| ------------ | ------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Storage**  | + un palier de réserve de nectar                  | 6 alvéoles, vers le haut                                                | Le déverrouilleur : c'est elle qui rend le reste payable                                                                                                |
| **Foragers** | +1 butineuse sur le trajet (rang I)               | 3 alvéoles, à droite (les rangs II-III en miel)                         | Le doublement sec — la récompense la plus lisible                                                                                                       |
| **Flight**   | Vitesse de vol, **très** légèrement               | 6 alvéoles, vers le bas                                                 | Assez pour raser un virage, jamais pour voler le tour à votre place                                                                                     |
| **Growth**   | Accélère le calendrier du pré                     | 6 alvéoles, vers la gauche                                              | Les fleurs reviennent plus tôt : un tour croise plus de corolles ouvertes                                                                               |
| **Workers**  | Donne une ouvrière, donc la transformation (§6.1) | 4 alvéoles, **au bout de la branche Storage** (les rangs II-IV en miel) | Le basculement du jeu : jusque-là le nectar s'améliore, à partir de là il se transforme ; son rang I exige **Storage IV**, écrit en prérequis explicite |

**Le rayon de la ruche**, payé en miel, remplit les **creux du centre** laissés
par les quatre premières branches. Il ne se dévoile qu'avec la première ouvrière.

| Branche      | Effet d'une alvéole                  | Forme                        | Intention                                                           |
| ------------ | ------------------------------------ | ---------------------------- | ------------------------------------------------------------------- |
| **Fanning**  | Lot plus court (`batchMs`)           | 4 alvéoles, en haut à droite | Rend du **temps** : le miel arrive plus souvent                     |
| **Thrift**   | Lot moins cher (`nectarPerBatch`)    | 4 alvéoles, en bas à gauche  | Rend du **nectar** : la transformation cesse d'assécher le rayon    |
| **Ripening** | Lot plus généreux (`honeyPerWorker`) | 4 alvéoles, en haut à gauche | Rend du **miel** : elle multiplie tout le reste, donc la plus chère |
| _+ Workers_  | +1 (ou +2) ouvrières                 | rangs II-IV                  | Le seul investissement qui se rembourse tout seul                   |
| _+ Foragers_ | +1 (ou +2) butineuses                | rangs II-III                 | Ramène le joueur au pré : plus de nectar, donc plus de lots         |

**Pourquoi ces alvéoles sont serrées au centre.** Trois branches de plus tirées
vers l'extérieur auraient fait huit bras et un écran qu'on ne peut plus lire sans
glissé. Le rayon **s'épaissit** au lieu de s'étendre — et une ruche qui se remplit
par le milieu est exactement ce que le rayon prétend être.

**Pourquoi l'alvéole de la première ouvrière est là et pas ailleurs.** Elle est la
plus chère du rayon en nectar (la réserve pleine des quatre premiers paliers à
vingt nectar près) et n'est **visible** qu'une fois ces quatre paliers bâtis. Deux
raisons : c'est la seule place où un tel prix est payable, et l'ordre
d'apprentissage y gagne — on n'ouvre le second métier de la ruche qu'après avoir
compris le premier. Elle est aussi la **clé** de toute la moitié en miel : rien de
ce qui règle la transformation n'apparaît avant elle.

**Règle d'équilibrage structurante.** Le nectar est plafonné : une alvéole en
nectar plus chère que la réserve du moment est **inatteignable à jamais** — le
joueur butine et la réserve sature avant le prix. D'où :

- la branche _Storage_ reste toujours payable sous le plafond courant : c'est
  elle qui ouvre tout le reste ;
- les rangs III demandent deux paliers de réserve, les rangs IV les quatre, les
  rangs V le cinquième, les rangs VI le sixième. Ce n'est pas un cul-de-sac, c'est
  un **ordre** : on agrandit sa ruche avant de s'offrir le luxe.
- **Toute nouvelle alvéole en nectar doit tenir sous le plafond maximal** (réserve
  complète), sinon elle est inachetable pour toujours. Vérifier `UPGRADE_EFFECT.
storageStep` avant d'ajouter un prix.

Le **miel n'a pas de plafond** : la moitié en miel échappe à cette contrainte, et
c'est ce qui lui permet de commencer très bas (3 miel, une douzaine de lots) puis
de monter sans borne. Le premier achat en miel doit tomber peu après la première
ouvrière — sinon la ressource qu'on vient de débloquer resterait muette.

### 7.4 Prestige — _conçu, non implémenté_

La gelée royale nourrit la reine suivante : reset de la partie contre un arbre de
reines permanent. `queens` et `royalJelly` sont persistés et accumulés, mais
aucune interface ne les dépense. **C'est le plus gros manque de design actif.**

## 8. Écrans & interface

| Scène   | Contenu                                                                                                                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Boot`  | Chargement, cuisson des textures procédurales et du fond de prairie                                                                                                                                                      |
| `Title` | Logo animé, jardin en tileset, bouton _New Game_ / _Continue_, bilan de la partie reprise et _Restart_ (voir 10.1), pop-up crédits, panneau de réglages (volumes), pied de page (version, crédit jam, liens itch/GitHub) |
| `Game`  | Barre de ressources · panneau _Colony_ · bouton du Rayon · le pré · bandeau d'état                                                                                                                                       |
| `Comb`  | Le Rayon. **Scène** superposée, pas pop-up (voir ci-dessous)                                                                                                                                                             |
| `Pause` | Échap, en surimpression : reprendre, réglages, retour au titre                                                                                                                                                           |

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

**Le détail de l'alvéole survolée** se lit dans une **colonne à droite** des
alvéoles, et non sur une ligne sous elles. Sous le rayon, il n'avait qu'une ligne
en travers de tout l'écran : les infobulles longues (les ouvrières, l'économie) y
tenaient à peine, et une seconde ligne aurait mangé la fenêtre sur toute sa
largeur. Sur le côté, la même place rend six lignes, avec le **nom** de
l'alvéole en tête. Rien ne s'y affiche quand rien n'est survolé.

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
  volumes musique/SFX persistés. La position d'un curseur n'est **pas** le gain :
  elle est élevée à la puissance 1/0,6 (loi de Stevens) avant d'atteindre le
  moteur audio, sinon toute la variation perçue se concentrerait dans les
  premiers pourcents et la moitié haute paraîtrait plate. Deux SFX de gameplay :
  une fleur butinée, un lot de miel versé. **Le butinage sonne moins fort en
  rejeu qu'en enregistrement** — le trajet tourne en boucle sans le joueur, à
  plein volume il deviendrait un métronome ; pendant un enregistrement, chaque
  corolle prise est un geste du joueur et s'entend en entier. **Un troisième SFX
  récompense le tour qui bat le meilleur connu**, et lui seul : sonner à chaque
  fin d'enregistrement dirait « c'est fini », pas « c'est mieux ». Manquent le son
  du dépôt à la ruche et celui du « Perfect ».
- **Crédits** : tout asset entre dans `CREDITS` (`strings.ts`) **en même temps
  que l'asset**, avec auteur et licence.

## 10. Sauvegarde

localStorage, autosave périodique (`FEEL.autosaveMs`), plus une sauvegarde aux
moments qui comptent : clôture d'un tour, ouverture du menu de pause, retour au
titre. Persistés : nectar, miel, gelée royale, effectifs, meilleur miel, reines,
identifiants d'alvéoles, meilleur trajet, et l'état de la transformation (lot en
cours et son avancement, reliquat de miel vers la gelée royale, interrupteur). Le
nectar d'un lot engagé a déjà quitté la réserve : on reprend le lot où il en
était plutôt que de le perdre.

**Règle de développement : tout état de jeu va dans `SaveData`, dans le même
changement que la mécanique qui l'introduit.** Une caste, une monnaie, un
compteur ou un interrupteur oublié ne se voit pas en développement — la partie
courante le tient en mémoire — mais seulement chez le joueur qui revient, sous la
forme d'une partie subtilement incohérente.

**Aucune migration entre versions.** La sauvegarde porte la version du jeu
(`GAME.version`, celle de `package.json`) ; relue par une autre version, elle est
**détruite** au lancement et le jeu se présente comme un premier lancement.
Écrire des migrations sur une jam où l'équilibrage, le rayon et les mécaniques
bougent à chaque itération coûterait plus que ça ne rend : un état ancien rendu
jouable de force est pire qu'une partie neuve. Faire monter la version suffit
donc à invalider les sauvegardes du terrain.

Trois garde-fous à la relecture : une alvéole dont l'identifiant a disparu du
rayon n'est pas ressuscitée ; un trajet qui ne serait pas rejouable est écarté
plutôt que rejoué de travers ; et une sauvegarde illisible (comme une version périmée) remet la partie
**en mémoire** à zéro — `GameState` est un singleton qui survit aux scènes, un
état à moitié relu s'y installerait sinon. C'est la même raison qui fait que le
bouton _Restart_ de l'écran-titre efface le disque **et** la mémoire.

Un trajet est jugé rejouable point par point, et aux deux bouts : à
l'enregistrement comme à la relecture. `JSON.stringify` ne sait pas écrire une
coordonnée non finie — il l'écrit `null`, qui se relit comme un **zéro** ajouté au
coin du pré. Le trajet abîmé ne se voit alors pas : il se charge, il se rejoue, et
la butineuse reste plantée au coin haut-gauche du pré pour un tour entier. C'est
pire qu'un trajet refusé, car le joueur croit son enregistrement perdu alors que
le jeu le rejoue en silence.

### 10.1 Le bilan de l'écran-titre

Quand une sauvegarde est reprise, l'écran-titre en montre le bilan sous le bouton
_Continue_ — le joueur qui revient doit reconnaître sa partie avant d'y entrer.

**Une ligne, deux nombres** : l'effectif total et le nombre d'alvéoles bâties.
C'est un seuil d'accueil, pas un tableau de bord : la partie doit se reconnaître
d'un coup d'œil, pas se lire. Le meilleur miel, les reines et le nectar/s du
meilleur tour y ont figuré et en sont tombés — ce sont des **scores**, quand ce
qu'on cherche ici est un **état**, et ils sont de toute façon dans le jeu, à un
clic. Sans sauvegarde, la ligne n'existe pas : le bouton _New Game_ est alors
seul, et le bloc se recentre.

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
relecture du trajet · nectar plafonné · le Rayon (8 branches sur deux monnaies,
dévoilement, achats) · **usage du miel** : effectifs et réglages des lots ·
transformation du nectar en miel par lots, sa jauge et ses gains
flottants · gelée royale par paliers · HUD complet et infobulles · relances de
première fois (trajet, rayon) et dévoilement du bandeau · écran-titre complet,
transitions, audio, pause · **sauvegarde active** : autosave, reprise, bilan sur
l'écran-titre, invalidation par version · déploiements Pages + itch.

**Manquant, par ordre d'impact design**

1. **Prestige** — gelée royale et reines accumulées mais indépensables : le jeu
   n'a pas de fin.
2. **Anneau de timing « Perfect »** — la mécanique est le cœur du skill et n'a
   aucun retour visuel autour de la corolle.
3. **Le rayon a une fin** — 37 alvéoles et puis plus rien. Tant que le prestige
   n'existe pas, la dernière alvéole bâtie est la fin de fait du jeu.
4. **Warrior** — caste sans rôle : aucune menace à garder.
5. SFX du dépôt à la ruche et du « Perfect » ; sprites abeille/fleur/ruche encore
   procéduraux ; migration des couleurs historiques vers la palette.

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
| **Recrutement des castes dans le panneau _Colony_** (`BEE_KINDS.cost`)   | Un second guichet à côté du Rayon : deux endroits pour une seule décision. Les effectifs se paient au rayon comme tout le reste (§6.2), et le panneau reste un état.                             |
| **Un rayon en nectar uniquement**                                        | Le miel se produisait sans jamais se dépenser. Le rayon se paie désormais dans deux monnaies (§6, §7.3) — le vol en nectar, la ruche en miel — et la boucle se ferme.                            |
| **Trois branches en miel tirées vers l'extérieur**                       | Huit bras auraient rendu le rayon illisible sans glissé. Elles remplissent les creux du centre : le rayon s'épaissit au lieu de s'étendre.                                                       |

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
