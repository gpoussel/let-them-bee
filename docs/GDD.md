# Let Them Bee — Game Design Document

> **Document vivant.** Il décrit le jeu **tel qu'il est**, pas tel qu'il fut imaginé.
> Toute modification de gameplay doit être répercutée ici dans le même changement
> (cf. `CLAUDE.md`). Les valeurs chiffrées ne sont jamais recopiées : elles vivent
> dans `src/config/` et ce document dit **pourquoi** elles sont là.

|               |                                                               |
| ------------- | ------------------------------------------------------------- |
| Titre         | **Let Them Bee**                                              |
| Version       | `0.6.0` (`package.json`, injectée dans `GAME.version`)        |
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
- **Sortie de boucle** : le rayon complet, ou l'essaimage (§7.4) — la colonie
  repart à zéro, la lignée reste.

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

**La ruche est au CENTRE du pré**, dans une clairière de 92 px où aucune fleur ne
pousse. Au centre, parce qu'un départ en coin faisait payer à chaque tour le même
long transit et rendait la moitié du pré mécaniquement moins bonne que l'autre :
au milieu, le vol de retour est court dans toutes les directions, et le périmètre
de garde (§7.6) devient un cercle qu'on peut frôler de n'importe où. La clairière,
parce qu'une corolle sous le panier serait invisible — et parce qu'elle est plus
large que le périmètre de dépôt le plus large qu'on puisse acheter (86 px) : une
fleur butinée à l'instant même où le tour se clôt ne dirait pas au joueur si elle
a compté. Les emplacements qui y tombent sont **re-tirés**, pas supprimés : le pré
garde son compte de fleurs, elles se serrent simplement en couronne autour de la
ruche.

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
une fois, avec la graine de la partie.

Conséquence : le pré est remis à zéro **au début de chaque enregistrement** et
**à chaque bouclage de la relecture**. Deux tours voient exactement les mêmes
fleurs aux mêmes secondes — sinon on comparerait de la chance.

**Un pré par partie.** La graine n'est pas dans le code : elle est **tirée au
premier lancement et sauvegardée** (`SaveData.fieldSeed`). Deux joueurs
n'apprennent donc pas le même terrain, et un même joueur retrouve le sien intact
à chaque retour. Un pré figé faisait du meilleur trajet une solution unique qui
se transmettait ; un pré retiré à chaque lancement aurait fait de
l'enregistrement une loterie — un trajet enregistré ne veut rien dire sur un
autre pré, et `bestHoney` ne se comparerait plus à lui-même. La graine persistée
est le seul point entre les deux.

Elle survit à l'essaimage — la colonie repart, le pré reste, c'est le terrain
qu'on a appris — et n'est retirée qu'au **Restart**, qui est précisément une
autre partie. `FLOWER.seed` ne sert plus que de **secours** : outils de dev, pré
de simulation, sauvegarde revenue sans graine.

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

**L'abeille nue vole mal, et c'est le point de départ du jeu.** Sous la main du
joueur, elle est lourde (`BEE.lerp` = 2,6) et elle **dérive** : sa cible s'écarte
du pointeur, portée par trois sinusoïdes de périodes incommensurables. Le motif ne
se lit pas à l'œil et pourtant il ne tire **aucun hasard** — la même seconde du
même tour donne la même dérive, le pré reste déterministe (§4.3), et un trajet
enregistré est exactement ce que le joueur a volé.

**Deux choses font que la dérive se voit** — une amplitude fixe passait
inaperçue, parce qu'à pleine vitesse vingt pixels de flottement disparaissent
sous le geste :

- elle **s'emballe avec la distance au pointeur**, et pas linéairement :
  `34 px × (0,25 + (distance / 110)^1,8)`, plafonné à 260 px d'écart. Pointeur
  collé à l'abeille, elle frémit ; à deux longueurs de bras, elle serpente ; à
  l'autre bout du pré, **elle fait n'importe quoi**. L'exposant est ce qui sépare
  « un peu mou » d'« incontrôlable » : une montée proportionnelle se corrige
  d'instinct, une montée qui s'emballe **oblige à rapprocher le pointeur**. Le
  plafond n'adoucit rien — sans lui la cible sortirait du pré et l'abeille
  filerait tout droit au lieu de battre la campagne ;
- elle est **surtout latérale** (65 %), perpendiculaire à la course : un écart de
  **cap**, pas une vibration. C'est ce qu'on apprend à corriger. La troisième
  sinusoïde, la plus lente, ne se voit pas de près et commande le vol de loin.

La leçon de pilotage est la même dans les deux cas : on **mène** une abeille, on
ne la téléporte pas.

La dérive **fond avec les améliorations** : −7 % par cran de la branche _Flight_,
et inversement proportionnelle au lissage — « ailes sûres » de la lignée et
**No Inertia** (§7.7) l'effacent en même temps que l'inertie. Une colonie nue dérive au
coefficient 1,0 ; six crans de vol la ramènent à 0,65 ; _No Inertia_ à 0,05, ce qui
revient à voler droit.

C'est le seul progrès du jeu que le joueur sente **au geste** plutôt que dans un
compteur. Une abeille docile dès la première minute ne laisserait rien à gagner au
pilotage : le rayon n'aurait plus qu'à vendre des chiffres. La dérive n'existe
**que** sous la main du joueur — la relecture repasse au pixel sur le trajet volé
(§5.4).

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
| **Gelée royale** | Une dose tous les `jellyThreshold` de miel gagné     | La Lignée de la Reine (§7.4) — elle seule survit à l'essaimage | Non                    |

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

| Caste       | Rôle                                                                                                                                  | Statut                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Forager** | L'abeille que l'on pilote. Ne produit rien seule.                                                                                     | Effectif porté par la branche `foragers` du rayon (1 + 1 + 2)    |
| **Worker**  | Ne quitte jamais la ruche, transforme le nectar en miel (§6.1).                                                                       | Effectif porté par la branche `workers` du rayon (1 + 1 + 1 + 2) |
| **Warrior** | Sécurise l'espace aérien autour de la ruche. Chaque guerrière élargit la zone de dépôt du nectar (hitbox de fin de tour) de 2 pixels. | Effectif porté par le grind et le jalon _Sentries_               |

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

**Le rayon fait 118 alvéoles, et il n'est pas écrit : il est engendré.** Trois
populations s'y côtoient, et la façon dont chacune existe dit son rôle.

| Population           | Combien | Comment elle existe                         | Pourquoi                                                                                                                    |
| -------------------- | ------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Début de partie**  | 46      | posée à la main (§7.3, §7.5)                | Son ordre de dévoilement **porte l'apprentissage du jeu** ; un ordre appris ne se recalcule pas                             |
| **Le grind**         | 62      | neuf boucles `for` (§7.6)                   | Un « Aérodynamisme XIII » écrit à la main serait une ligne de copie ; ce qui se décide est une **courbe**, en trois nombres |
| **Jalons et pièges** | 10      | effet et prix à la main, **place calculée** | Chacun retourne une règle du jeu (§7.7) ou tend un traquenard (§7.8) — mais aucune coordonnée n'est écrite deux fois        |

**Une seule géométrie, une seule table d'occupation.** Les 250 alvéoles se
placent toutes par la même règle : _une branche pousse par son bord, vers le
dehors, dans sa direction_. À chaque pas, on prend la case **libre** qui touche la
branche et qui minimise `distance à la ruche + 2,5 × écart d'angle avec le cap`.
Le premier terme pousse vers l'extérieur, le second tient le cap — et comme le cap
est un **coût** et non une interdiction, une branche coincée contourne au lieu de
mourir : c'est ce qui fait la **spirale**. Les huit branches poussent **à tour de
rôle**, un cran chacune par tour, sinon la première aurait tout l'espace et la
dernière ce qui reste.

Deux alvéoles ne peuvent donc pas se superposer : la table d'occupation est
commune, et une branche entièrement **murée** par ses voisines ne s'arrête pas —
elle reprend la case libre du rayon la plus proche de sa pointe, qui touche
forcément de la cire existante. Le dévoilement (§7.2) reste vrai : le rayon n'a
pas d'île, quel que soit le nombre d'alvéoles demandé.

### 7.2 Dévoilement

Une alvéole se dévoile dès qu'elle **touche de la cire bâtie** : la ruche, ou
une alvéole déjà payée, peu importe la branche. C'est tout. Aucune règle ne
nomme d'alvéole ni de rang : le rayon se lit à l'œil, et ce qu'on voit au bord
du construit est ce qu'on peut acheter.

La géométrie porte donc l'ordre à elle seule. Une branche longue s'ouvre alvéole
par alvéole ; là où elle s'incurve et revient contre elle-même, le rang V se
montre en même temps que le IV et peut s'acheter **avant** lui. Ce n'est pas un
raccourci : les deux se paient de toute façon, et le plafond de réserve (§7.5)
reste le vrai ordonnanceur. À l'inverse, une alvéole que rien ne touche encore
reste invisible, quel que soit son prix — c'est ainsi que le bout de la branche
Storage garde ce qui suit sous clé.

La **seule** exception ne parle pas de position mais de **monnaie** : une alvéole
qui se paie en miel reste cachée tant qu'aucune ouvrière n'existe. Sans elle le
miel n'existe pas, et afficher un prix dans une monnaie qu'on ne peut pas encore
gagner ne dit rien au joueur.

Une alvéole s'achète **une fois, et pour de bon**.

### 7.3 Les huit branches

**Le rayon du vol**, payé en nectar, part de quatre voisines de la ruche :

| Branche      | Effet d'une alvéole                                    | Forme                                                            | Intention                                                                                                                                                                                              |
| ------------ | ------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Storage**  | + un palier de réserve, **quadratique** (§7.5)         | **15 alvéoles** (I à XV), vers le haut, en nappe                 | Le déverrouilleur : c'est elle qui rend le reste payable — courte, mais chaque palier prend les trois quarts de la réserve qu'a offerte le précédent                                                   |
| **Foragers** | +1 butineuse sur le trajet (rang I)                    | 3 alvéoles, à droite (les rangs II-III en miel)                  | Le doublement sec — la récompense la plus lisible                                                                                                                                                      |
| **Flight**   | Vitesse de vol (très légèrement) **et −7 % de dérive** | 6 alvéoles, vers le bas                                          | Assez pour raser un virage, jamais pour voler le tour à votre place — et c'est le seul achat que le joueur sente **au geste** (§5.2)                                                                   |
| **Growth**   | Accélère le calendrier du pré                          | 6 alvéoles, vers la gauche                                       | Les fleurs reviennent plus tôt : un tour croise plus de corolles ouvertes                                                                                                                              |
| **Workers**  | Donne une ouvrière, donc la transformation (§6.1)      | 4 alvéoles, **sur la branche Storage** (les rangs II-IV en miel) | Le basculement du jeu : jusque-là le nectar s'améliore, à partir de là il se transforme ; elle pousse **contre le troisième palier de réserve** : rien ne la montre avant que la réserve soit menée là |

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

**Pourquoi l'alvéole de la première ouvrière est là et pas ailleurs.** Elle est
posée **contre le troisième palier de réserve**, et n'est **visible** qu'une fois
celui-ci bâti — le plafond vaut alors 2200, ses 640 nectar sont donc payables
sans autre achat. Deux raisons : c'est la première place où un tel prix est
payable, et l'ordre d'apprentissage y gagne — on n'ouvre le second métier de la
ruche qu'après avoir compris le premier. Elle est aussi la **clé** de toute la
moitié en miel : rien de ce qui règle la transformation n'apparaît avant elle.

Elle **précède** donc le quatrième palier de réserve, qui se dévoile par elle et
non l'inverse : le basculement du jeu ne doit pas s'annoncer au bout du plus long
prix en nectar du début. La branche réserve enjambe l'ouvrière — son cinquième
palier touche le troisième — mais elle n'est pas coupée pour autant.

**Règle d'équilibrage structurante.** Le nectar est plafonné : une alvéole en
nectar plus chère que la réserve du moment est **inatteignable à jamais** — le
joueur butine et la réserve sature avant le prix. D'où :

- la branche _Storage_ reste toujours payable sous le plafond courant : c'est
  elle qui ouvre tout le reste, et c'est désormais **garanti par construction**
  (§7.5) et non plus vérifié à la main ;
- les rangs III demandent deux paliers de réserve, les rangs IV trois. Ce n'est
  pas un cul-de-sac, c'est un **ordre** : on agrandit sa ruche avant de s'offrir
  le luxe.
- **Toute nouvelle alvéole en nectar doit tenir sous `getNectarCapacity(n)`** pour
  le niveau de réserve `n` auquel elle se dévoile, sinon elle est inachetable pour
  toujours.

**Le rayon du vol se pilote, il ne se coche pas.** Ses prix en nectar sont
délibérément élevés : chaque alvéole doit se gagner par des trajets, pas tomber en
passant. Ce durcissement ne peut pas se faire seul — **le plafond monte avec lui,
toujours** ; c'est la même décision, pas deux.

Le **miel n'a pas de plafond** : la moitié en miel échappe à cette contrainte, et
c'est ce qui lui permet de commencer très bas (1 miel, **quatre lots**) puis de
monter sans borne. Le premier achat en miel doit tomber peu après la première
ouvrière — sinon la ressource qu'on vient de débloquer resterait muette.

**La moitié en miel se paie moins cher que la moitié en nectar, et c'est la même
décision que le durcissement du rayon du vol.** Le nectar **se pilote** : chaque
alvéole doit se gagner par des trajets. Le miel **récompense la transition** :
une fois la première ouvrière posée, l'automatisation doit se faire sentir tout
de suite, sinon la bascule du jeu (§7.2) se paie d'une attente au lieu d'un gain.
D'où deux règles :

- les **rangs I** de _Fanning_, _Thrift_ et _Ripening_ tiennent en une poignée de
  lots (1, 2 et 3 miel) — le premier réglage arrive avant que l'attente du lot
  n'ait eu le temps de lasser ;
- les **rangs II-III des effectifs** (_Workers_, _Foragers_) sont bas parce
  qu'eux seuls ferment la boucle : plus de miel achète une ouvrière, qui rend
  plus de miel. Une boucle de rétroaction qui met trop longtemps à se refermer ne
  se lit pas comme une boucle.

L'absence de plafond est ce qui autorise cette liberté : aucun prix en miel, si
bas ou si haut soit-il, ne peut rendre le rayon inachevable.

**Le prix mixte.** Une alvéole porte un prix `{ honey?, nectar? }` : les deux
monnaies sont facultatives et **cumulatives**. Une alvéole qui porte les deux se
paie dans les deux **à la fois**, jamais au choix — il n'y a pas de conversion
dans ce jeu. C'est ce qui manquait au rayon pour que ses deux moitiés se parlent :
le nectar **se pilote** et il est plafonné, le miel **s'accumule** et ne l'est
pas ; un prix mixte demande donc les deux vertus en même temps — avoir volé assez
bien pour remplir une réserve, et avoir laissé la ruche tourner assez longtemps
pour la transformer. Le bouton d'achat vérifie `honey >= cost.honey` **et**
`nectar >= cost.nectar` ; le panneau d'information affiche **deux lignes de prix**
distinctes, chacune avec son icône, et chacune se grise séparément — le joueur
voit laquelle des deux lui manque. Une alvéole mixte reste cachée tant qu'aucune
ouvrière n'existe, comme n'importe quel prix en miel (§7.2).

### 7.4 La Lignée de la Reine (prestige)

Le rayon est ce qu'une colonie **bâtit** ; la lignée est ce qu'elle **lègue**.
L'essaimage — _Leave the hive_ — remet la partie à zéro : réserve, miel,
effectifs, alvéoles, meilleur trajet, tout tombe. Ne traversent que la **gelée
royale non dépensée**, les **nœuds déjà acquis** et le **compte des reines**.
C'est la seule chose du jeu qui survive à une remise à zéro.

**Trois règles**, et elles expliquent chaque nœud :

1. **Un nœud ne joue jamais le tour à la place du joueur.** Le pilotage est la
   seule chose que le joueur maîtrise vraiment. Ce qui touche au vol est donc
   minuscule : un cran de confort, jamais une dispense (cf. §13).
2. **Un nœud fait gagner du TEMPS, il ne dépasse pas les plafonds.** Les lignées
   d'héritage ne donnent rien qu'une colonie ne puisse acheter elle-même : les
   mêmes alvéoles, **plus tôt**. La deuxième partie ne commence pas au même
   endroit que la première, mais elle ne monte pas plus haut.
3. **Un nœud se lit sur le pré ou sur le rayon.** Une fleur de plus se voit, une
   seconde de plus se voit, un bouton _Buy all_ se voit. Un multiplicateur caché
   ne serait qu'un chiffre qui monte.

**Les neuf branches** (paliers, du moins cher au plus cher ; prix en gelée dans
`src/config/lineage.ts`) :

| Branche       | Paliers  | Effet d'un palier                                                              |
| ------------- | -------- | ------------------------------------------------------------------------------ |
| `nectarBlood` | I·II·III | La colonie naît avec les alvéoles **nectar** du rang correspondant             |
| `honeyBlood`  | I·II·III | La colonie naît avec les alvéoles **miel** du rang correspondant               |
| `busyWax`     | 1        | Débloque le bouton **_Buy all_** du Rayon                                      |
| `wideMeadow`  | I·II·III | **+3 fleurs** au pré par palier (19 → 28 au rang III)                          |
| `richBloom`   | I·II·III | Nectar de base de toutes les corolles **+10 %** par palier                     |
| `quickRoots`  | I·II·III | Repos d'une fleur fanée **× 0,7** par palier : elle repousse plus vite         |
| `steadyWings` | 1        | Inertie de l'abeille **très légèrement** réduite (pilotage seulement)          |
| `longDays`    | I·II     | Couperet du tour **10 s → 11 s → 12 s**                                        |
| `keenEye`     | I·II·III | Marge du **« Perfect »** élargie de 0,05 de fraîcheur par palier (0,85 → 0,70) |

`honeyBlood` coûte plus cher que `nectarBlood` à rang égal : ces alvéoles-là se
paient normalement dans une monnaie sans plafond, et les hériter saute une boucle
entière (miel → ouvrières → miel). `busyWax` n'a qu'un palier et n'ajoute aucune
puissance : il retire le clic répété à un joueur qui a déjà bâti ce rayon-là.

`richBloom`, `quickRoots` et `keenEye` montent jusqu'au rang III. Les deux
premières se lisent sur le pré — une corolle plus grasse, une tige qui repousse —
et un cran unique s'y noyait dans le bruit d'un tour. `keenEye` y monte aussi,
mais par pas de 0,05 seulement : au rang III il reste les trois quarts de la
corolle à ne pas manquer, et la récolte double reste un geste (règle 1).

**Les fleurs de `wideMeadow` sont semées EN PLUS des autres, dans le même
tirage** : les dix-neuf premiers emplacements d'un pré à vingt-deux fleurs sont
rigoureusement ceux d'un pré à dix-neuf. Un héritage n'invalide pas le terrain appris
à la colonie précédente, il lui ajoute des corolles.

Elles vont par **trois**, et pas à l'unité : le pré est ce que le joueur regarde
pendant tout le jeu, et une corolle de plus sur dix-neuf ne se voyait pas. Un
héritage qui change le terrain doit se voir **à l'œil dès la première seconde**
de la colonie suivante — au rang III, la prairie est visiblement plus dense.

**Les prix.** La gelée tombe par doses de 0,5 tous les 50 miel : une première
colonie menée au bout de son rayon en rapporte quelques unités, pas quelques
dizaines. Un premier essaimage doit pouvoir s'offrir **un** nœud d'entrée, pas
davantage — sinon l'arbre se solderait d'un coup et n'aurait plus rien à raconter
au troisième tour. Les rangs suivants doublent à peu près, parce que la colonie
qui les vise part elle-même d'un héritage : elle produit plus, elle paie plus.

#### Le déroulé : un seul bouton, un guichet qui ne referme plus

L'arbre **s'ouvre à tout moment** par l'étoile de la barre de ressources, et il
n'a **qu'un seul bouton** : _Leave the hive_, l'essaimage. Rien d'autre ne se
valide, rien ne s'y termine — on ouvre, on dépense, on ferme.

**Avant la première reine**, l'arbre est un **plan** : les nœuds se survolent et
se lisent, aucun ne s'achète. Séparer la lecture de la dépense est délibéré : le
joueur doit pouvoir voir ce qu'il achèterait **avant** de décider de tout perdre.
Un arbre qui ne s'ouvrirait qu'après le reset demanderait de signer sans voir.

**Après le premier essaimage**, le guichet reste ouvert **pour toujours** : la
gelée se dépense quand le joueur le décide, et non dans une fenêtre qui se
referme derrière lui. Une fenêtre obligerait à choisir vite, donc à choisir mal —
et elle interdirait de mettre de côté pour un nœud de rang III.

L'essaimage part en **deux clics** sur le même bouton : le premier arme et le dit
(_Click again to leave_), le second détruit la colonie. Le geste coûte une partie
entière ; il ne se déclenche pas sur un clic de travers. Une pop-up de
confirmation cacherait justement l'arbre dont elle parle. L'amorce se désamorce
seule au bout de quelques secondes : une amorce oubliée est un piège tendu au
clic suivant.

La partie est relancée **sous l'écran**, dès l'essaimage : le pré, le couperet et
l'inertie sont ceux de la nouvelle lignée quand le joueur y revient.

Un nœud brille dès qu'il est payable et atteignable, **y compris avant
l'essaimage** : c'est l'invitation, et c'est précisément ce que le joueur est venu
regarder.

### 7.5 La branche Storage : une courbe, pas un pas

La réserve est la branche la plus **longue** du rayon — quinze alvéoles, _Storage
I_ à _Storage XV_ — mais elle reste courte, et c'est un choix : cinquante paliers
se lisaient comme une corvée, cinquante clics dont aucun ne pesait. Quinze paliers
sur une courbe **raide** font le contraire : peu de décisions, chacune coûteuse.
Ni son effet ni son prix ne sont linéaires — les deux suivent une courbe en
$O(n^2)$.

**L'effet** (`getNectarCapacity`, dans `config/balance.ts`) :

$$\text{capacité}(n) = 100 + 200\,n^2 + 100\,n$$

soit 100 / 400 / 1100 / 2200 / 3700 / 5600 / 7900… jusqu'à **46 600** au quinzième
et dernier palier. Un pas fixe aurait fait de la quinzième alvéole un « +5 % »
inaudible ; ici la dernière vaut à elle seule plus que les cinq premières.

**Le prix** (`storageCost`, dans `config/upgrades.ts`) :
$150\,n^2 - 225\,n + 150$, soit 75 / 300 / 825 / 1650 / 2775… jusqu'à 30 525.

**LA RÈGLE D'OR — anti-blocage.** Le prix du rang $n$ doit rester **strictement
inférieur à la capacité offerte par le rang $n-1$** :

$$\text{coût}(n) < \text{capacité}(n-1)$$

Sans elle, le jeu se **bloque définitivement** : le nectar est plafonné, une
alvéole plus chère que la réserve pleine ne peut jamais être payée — le joueur
butine, la réserve sature avant le prix — et comme c'est cette branche qui relève
le plafond, un seul rang trop cher fige tout le rayon du vol.

Ces coefficients-là sont exactement les **trois quarts** de $\text{capacité}(n-1)$
— $0{,}75 \times (200\,n^2 - 300\,n + 200)$ : le prix le plus dur que la règle
autorise, et pourtant sans risque. Chaque alvéole coûte les trois quarts d'une
réserve pleine, la marge restante est le quart, et un quart d'une quantité positive
est positif pour tout $n$ : la règle tient par construction, sans avoir à discuter
d'un discriminant. Le code **plafonne en plus** le prix à `capacité(n-1) - 10` : ce
n'est pas un réglage d'équilibrage mais un **filet**, pour que retoucher A, B ou C
ne puisse au pire qu'aplatir la courbe de prix, jamais bloquer une partie.

**La forme.** Quinze alvéoles pourraient s'écrire à la main, mais leur prix sort
d'une formule et la géométrie suit la même règle : elle est **générée**, pour que
changer le nombre de paliers ne demande jamais de replacer des coordonnées. Les six
premières gardent exactement leur tracé d'origine — le coude qui remonte à droite,
et surtout l'alvéole contre laquelle pousse la première ouvrière : ce tracé porte
l'ordre de dévoilement du début de partie. Au-delà, la branche cesse d'être un fil
et devient un **pavage** : elle remplit le haut du rayon en serpentin, cinq
colonnes de large, ligne après ligne. Un fil de quinze alvéoles aurait tiré une
antenne de 500 px hors de la fenêtre ; le serpentin fait ce que fait un vrai
rayon — il s'étend en **nappe**. Chaque alvéole touche la précédente : le
dévoilement (§7.2) reste ce qu'il est, une cire qui avance de proche en proche.

**Ce que cela change ailleurs.** Le plafond monte bien plus haut et bien plus vite
qu'avec l'ancien pas fixe de 150. Les prix en nectar des autres branches n'ont pas
bougé : les rangs III à VI se paient donc un ou deux paliers de réserve plus tôt
qu'auparavant. C'est assumé — ce qui borne la progression n'est plus le plafond de
la réserve mais le **prix du palier suivant**, qui en prend les trois quarts.

**Ce que cela change à l'écran.** La réserve atteint cinq chiffres (46 600 au rang
XV) et les prix aussi (30,5 k). Tout nombre affiché dans un contenant étroit —
prix d'une alvéole, jauge de réserve, bilan d'un trajet — passe par `fmtBig` :
exact jusqu'à 9 999, abrégé au-delà (`15.4k`). Le seuil est haut **exprès** : ces
chiffres-là se comparent (« il me manque combien ? »), et « 1.4k » perd la centaine
qui décide. Le rayon, lui, se **glisse** : sa course est bornée séparément des
quatre côtés, parce que la cire monte deux rangées de nappe au-dessus de la ruche
et que rien ne descend autant.

### 7.6 Le grind : neuf branches, 62 alvéoles

Le début de partie apprend le jeu ; le grind est ce qu'on achète **en regardant
ailleurs**. Aucune de ses alvéoles ne déverrouille quoi que ce soit : elles font
monter un chiffre de 0,5 % à 5 % à la fois. C'est la différence entre un **palier**
(la réserve : peu de décisions, chacune coûteuse) et un **cran** (le grind : des
centaines, dont aucune ne se pense).

Cinq thèmes ; deux branches chacun, sauf la **défense spatiale** qui n'en a
qu'une. Chaque branche s'amorce contre une alvéole
du début de partie — son point d'attache appartient à une **autre** branche, il
sert de départ sans jamais compter comme un cran : la première alvéole du grind se
montre donc dès que la branche d'accueil est bâtie.

| Thème                    | Branche      | Crans | Effet d'un cran                                         | Prix du I → du dernier                 |
| ------------------------ | ------------ | ----- | ------------------------------------------------------- | -------------------------------------- |
| **Architecture de cire** | _Micro-naps_ | **8** | −1 % sur `batchMs` (multiplicatif : n'atteint jamais 0) | miel ×1,63 · 60 → 1,8 k                |
| **Architecture de cire** | _Slow Cure_  | **8** | +4 % de miel par lot **et** +3 % de durée de lot        | miel ×1,63 · 120 → 3,6 k               |
| **Botanique avancée**    | _Airflow_    | **8** | +0,5 % de vitesse de vol (additif au vol de départ)     | nectar, courbe du plafond · 594 → 28 k |
| **Botanique avancée**    | _Deep Roots_ | **6** | −2 % sur le repos d'une fleur fanée                     | nectar, courbe du plafond · 800 → 23 k |
| **Phéromones**           | _Frenzy_     | **6** | +0,5 s sur le chrono du tour                            | **mixte** miel ×1,97 + nectar          |
| **Phéromones**           | _Synergy_    | **8** | +35 % sur ce que vaut une ouvrière (**multiplicatif**)  | miel ×1,63 · 200 → 6,0 k               |
| **Génétique**            | _Brood_      | **6** | +1 butineuse **fantôme**                                | **mixte** miel ×1,97 + nectar          |
| **Génétique**            | _Hatchery_   | **6** | **+n ouvrières au cran n** (1, 2, 3… 6 ; 21 en tout)    | miel ×1,97 · 400 → 12 k                |
| **Défense spatiale**     | _Patrols_    | **6** | +1 guerrière (élargit le périmètre de retour de 2 px)   | miel ×1,97 · 500 → 15 k                |

**Huit crans au plus, six pour la moitié d'entre elles — c'est la DURÉE DE PARTIE
qui les fixe.** Une partie doit tenir en **deux heures**, et le temps d'un rayon
est d'abord un **nombre d'achats** : prix et production montant ensemble, chaque
alvéole coûte à peu près la même attente que la précédente. Quinze et dix
donnaient 166 alvéoles et **soixante-dix heures** — mesuré, pas estimé. Et le
constat qui a tranché : baisser les prix n'y changeait rien. Prix divisés par
six et production multipliée par quatre-vingt-huit ramenaient encore à cinq
heures ; c'est le **nombre** qui commande, pas la courbe. Huit et six font 118
alvéoles, et deux heures.

La lisibilité y gagne au passage, ce qui n'est pas un hasard : un rang s'affiche
en chiffres romains, « VIII » se lit là où « XXXVII » se déchiffre, et une
branche de cinquante crans n'est pas cinquante décisions mais une décision suivie
de quarante-neuf clics. Huit pour les branches qui **règlent** (elles ont besoin
d'amplitude), six pour celles qui donnent des abeilles ou du temps de vol (chaque
cran y pèse déjà lourd).

**Deux nombres par branche, et un seul pour toutes.** Ce qui se décide ici n'est
pas une alvéole mais une **courbe** : combien de crans, et à quelle base. La
croissance, elle, ne se choisit plus branche par branche — elle se **déduit** d'un
écart commun, `SPAN = 30`, entre le premier cran et le dernier. Une branche de
huit crans croît en `30^(1/7)` ≈ 1,63, une de six en `30^(1/5)` ≈ 1,97 : la
branche courte monte plus vite parce qu'elle a moins de marches pour faire le même
chemin. C'est ce qui garde les branches **comparables** quand on change leur
longueur, et ce qui fait de la durée de partie un réglage à deux nombres au lieu
de sept. Le miel suit `base × croissance^(n-1)` — il n'a pas de plafond, sa courbe
peut donc être aussi raide qu'on veut. Le nectar, lui, **est** la courbe du plafond :
`capacité(15 × n / crans) × part`, avec `part < 1` — et comme il est écrit en
fonction du nombre de crans, raccourcir une branche ne peut pas la rendre
impayable, seulement resserrer ses paliers. Une branche en nectar ne peut
donc pas se rendre inachetable en s'allongeant : son dernier cran demande une
fraction du plafond ultime, pas un multiple. Un assert le vérifie **à l'import du
module** — un rayon bloqué ne se découvre pas au bout de six heures de partie, il
ne démarre pas.

**Pourquoi la courbe du miel doit composer.** Le prix d'un cran est exponentiel ;
si tout ce qui produit du miel est additif (`1 + n × pas`), la production est
**linéaire** et l'écart se creuse jusqu'à l'arrêt. Deux branches portent donc la
croissance, et elles se **multiplient** l'une l'autre : _Hatchery_ verse son rang
en ouvrières — un prix qui double à chaque cran mérite un gain qui monte, sans
quoi le dixième cran vaut le premier à cinq cents fois le prix — et _Synergy_
multiplie ce que vaut **chaque** ouvrière. Effectif × valeur de l'ouvrière est un
produit de deux termes croissants : la courbe est quadratique sans qu'aucune
mécanique nouvelle ait été ajoutée. C'est la même boucle qu'au §7.5, poussée
jusqu'au bout du rayon.

**Pourquoi additivement, pour le vol.** _Airflow_ s'ajoute au vol du début de
partie au lieu de le multiplier, pour que le quinzième cran pèse exactement autant
que le premier. Une branche de grind ne doit pas s'emballer : elle doit
**durer**.

**Pourquoi une branche qui va dans les deux sens.** _Slow Cure_ allonge le lot en
le rendant plus riche, _Micro-naps_ le raccourcit. Les acheter toutes les deux
n'est pas une contradiction, c'est le **réglage** : le joueur place son curseur
entre une ruche qui bat vite et une ruche qui rend gros. Le net est positif dans
les deux cas — ce sont des crans, pas des pièges (§7.8).

**Les fantômes.** _Brood_ verse des butineuses qui ne sont **pas dessinées**
et ne comptent pas dans les effectifs : elles volent le même trajet et multiplient
ce qu'il rapporte. Une seule abeille à l'écran reste lisible, et le tour de
référence reste le même pour toutes (§5.5).

**Le périmètre est la seule branche qui joue sur le DIVISEUR.** Un tour est jugé
au nectar **par seconde** : toutes les autres branches gonflent le butin,
_Patrols_ raccourcit le vol de **retour**. Chaque guerrière élargit de 2 px la
zone où le nectar se dépose (§8) — la butineuse ne rentre plus au centre de la
ruche, elle franchit la ligne de garde et le tour se clôt. Rien n'est
rétroactif : le trajet déjà enregistré a été volé jusqu'à l'ancien périmètre et
garde sa durée. Pour toucher le raccourci, il faut **reprendre la souris**. C'est
une branche de fin de partie qui renvoie au pilotage, et elle reste rigoureusement
déterministe : le rayon de la hitbox est une constante pendant tout le tour,
enregistrement comme relecture (§4.3).

### 7.7 Les jalons : sept alvéoles qui retournent une règle

Au **bout** de leur branche — le seul endroit du rayon où une récompense de
plusieurs heures ne peut pas tomber trop tôt. Leur effet et leur prix sont pesés à
la main, un par un ; leur place est calculée comme le reste.

| Jalon          | Au bout de   | Ce qu'il retourne                                                                                                                      | Prix                     |
| -------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **Waggle**     | _Brood_      | +1 butineuse fantôme par **tranche de 10 ouvrières**                                                                                   | 250 k miel **+ plafond** |
| **Mutants**    | _Deep Roots_ | Le _Perfect_ passe de ×2 à **×3**                                                                                                      | 150 k miel               |
| **Digestion**  | _Airflow_    | Seuil de gelée royale **−20 %** (50 → 40 miel)                                                                                         | 80 k miel **+ plafond**  |
| **No Inertia** | _Frenzy_     | L'inertie du pilotage manuel disparaît à **95 %**                                                                                      | 25 k miel                |
| **Gold Swarm** | _Hatchery_   | L'essaimage garde **10 %** du miel accumulé                                                                                            | 300 k miel               |
| **Bud Clock**  | _Slow Cure_  | Un bourgeon **annonce** son ouverture (losange qui enfle)                                                                              | plafond de nectar        |
| **Sentries**   | _Patrols_    | **+10 guerrières d'un coup.** La zone de dépôt s'élargit massivement (+20 px), permettant des trajets en « touch-and-go » très courts. | 40 k miel                |

Chacun dit quelque chose que le grind ne peut pas dire :

- **Waggle** est le seul nœud qui fasse se parler la ruche et le pré :
  embaucher à l'intérieur fait enfin voler plus fort dehors ;
- **Mutants** et **No Inertia** récompensent le **pilotage** et rien
  d'autre. Ils ne valent que ce que vaut le trajet du joueur, et pour un trajet
  quelconque ils ne valent rien. _No Inertia_ ne rapporte pas un nectar de plus :
  il rend possible le trajet qu'on n'arrivait pas à tracer ;
- **Digestion** est le seul nœud du rayon qui accélère le **méta-jeu** — d'où
  son prix au plafond ;
- **Gold Swarm** est le seul qui **survive** au rayon, et donc le seul qui pousse
  à **retarder** le prestige au lieu de le précipiter (§7.4) ;
- **Bud Clock** ne change aucun chiffre : il change ce que le joueur **voit**, et
  c'est ce qui fait les meilleurs trajets. Le repère s'allume à 70 % de la pousse et
  enfle jusqu'à l'ouverture — il est piloté par l'**avancement du bourgeon**, jamais
  par l'horloge réelle, sinon deux relectures du même trajet ne se ressembleraient
  plus (§4.3) ;
- **Sentries** est le seul jalon qui rende du **temps** sans toucher au butin :
  vingt pixels d'un coup, c'est le passage du retour à la ruche au simple
  frôlement. Il ne se lit que la souris à la main — acheté puis oublié, il ne
  change pas un chiffre du trajet en cours.

### 7.8 Les pièges et les cosmétiques

Trois alvéoles posées **tout près de la ruche**, contre les branches du début de
partie. C'est indispensable : un piège qu'on ne rencontre qu'à la fin n'apprend
rien. Aucun ne ferme quoi que ce soit — ils sont en bout de course, rien ne pousse
derrière.

| Alvéole        | Contre     | Ce qu'elle fait                                | Prix        |
| -------------- | ---------- | ---------------------------------------------- | ----------- |
| **Heavy Load** | _Foragers_ | **+0,1 nectar par vol**, à plat, pour toujours | 2,5 k miel  |
| **Bright Wax** | _Ripening_ | Des étincelles sur la ruche                    | 30 k nectar |
| **Low Hum**    | _Flight_   | Le son de butinage descend de 120 cents        | 6 k miel    |

**Heavy Load est le piège mathématique**, et il est honnête : le jeu affiche
exactement ce qu'il donne. Un bonus **additif** au milieu d'un jeu multiplicatif est
excellent au premier tour et risible au centième ; le prix est calé pour être
tentant au moment où on le croise. Le joueur qui lit ce qu'il achète y coupe,
l'autre paie sa leçon — une fois.

**L'alvéole _Sentries_ a été retirée des pièges.** Ce qui n'était qu'un
investissement inutile pour le roleplay est devenu une véritable composante
d'optimisation (voir §7.7).

**Bright Wax et Low Hum ne touchent à rien.** Ce sont des achats qu'on fait pour
soi ; les étincelles vivent hors du calendrier du tour, elles ne peuvent donc pas
fausser une relecture (§4.3).

## 8. Écrans & interface

| Scène     | Contenu                                                                                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Boot`    | Chargement, cuisson des textures procédurales et du fond de prairie                                                                                                                                                      |
| `Title`   | Logo animé, jardin en tileset, bouton _New Game_ / _Continue_, bilan de la partie reprise et _Restart_ (voir 10.1), pop-up crédits, panneau de réglages (volumes), pied de page (version, crédit jam, liens itch/GitHub) |
| `Game`    | Barre de ressources · panneau _Colony_ · bouton du Rayon · le pré · bandeau d'état                                                                                                                                       |
| `Comb`    | Le Rayon. **Scène** superposée, pas pop-up (voir ci-dessous)                                                                                                                                                             |
| `Lineage` | La Lignée de la Reine (§7.4). Même emprise que le Rayon : neuf nœuds, l'essaimage en bas                                                                                                                                 |
| `Pause`   | Échap, en surimpression : reprendre, réglages, retour au titre                                                                                                                                                           |

**Découpe de l'écran de jeu** (`SCREEN`, coordonnées absolues) : barre de
ressources en haut ; à gauche la colonne _Colony_ surmontant le bouton du Rayon ;
à droite le pré, surmontant le bandeau d'état.

**Le bandeau d'état** est le poste de commande du trajet : message / consigne /
verdict, le bilan du meilleur tour (durée, nectar, **nectar/s**) en trois cases
côte à côte, le compte à rebours (visible **uniquement** pendant un
enregistrement — un cadran mort ne dit rien à personne) et le bouton.

**La barre d'espace double le bouton** : elle lance le tour (« Record a run » /
« Beat this run ») et l'abandonne (« Give up »). Le trajet se dessine à la
souris ; obliger la main à quitter le pré pour aller viser le bouton coûte un
temps qui compte, puisque c'est le chrono qu'on optimise.

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

**Le périmètre de garde.** Un fin liseré pointillé ambré dessine un cercle autour
de la ruche. Son rayon grandit à chaque ajout de guerrière. Il ne clignote pas
pour ne pas surcharger l'écran, mais il offre au joueur une cible visuelle exacte
à frôler lors de l'enregistrement pour optimiser son chrono.

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

**Le bilan de la ruche** occupe le **bas de cette même colonne**, en permanence.
Une quinzaine de lignes — effectifs, vol, pré, transformation — presque toutes en
**pourcentage d'écart avec la colonie nue**, dont la valeur de base ne s'écrit
nulle part : le joueur n'a pas à savoir à quelle vitesse vole une abeille pour
lire « Flight +12 % ». Une colonie neuve affiche donc une colonne de « +0 % », et
c'est le bon repère — chaque ligne dit ce qui a été **gagné**, pas une grandeur
physique. Restent en clair les seules valeurs qu'un pourcentage rendrait
illisibles : un effectif, la contenance de la réserve, le « Perfect ×2 ».

**Au survol d'une alvéole, les lignes que l'achat changerait passent au jaune et
montrent le pas** (`Workers 0 > 1`) ; les autres ne bougent pas. C'est la réponse
à la seule question qu'on se pose devant un prix — _qu'est-ce que ça me fait ?_ —
et elle n'est pas prédite : l'alvéole est réellement bâtie le temps d'une lecture
puis retirée, de sorte que l'aperçu ne peut pas diverger de ce qui arrivera. Le
bloc est **ancré en bas** et non posé sous l'infobulle, dont la hauteur varie : le
regard revient toujours à la même ligne pour y voir apparaître la flèche.

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

**La Lignée** reprend exactement la même emprise et le même bois que le Rayon :
ce sont les deux arbres du jeu, ils se regardent de la même façon. Elle ne se
déplace pas au glissé — neuf nœuds tiennent d'un seul écran, et **un plan doit se
lire d'un coup d'œil**. Chaque nœud porte son palier en chiffre romain et son prix
sous lui, avec le pot de gelée ; le détail du nœud survolé occupe la ligne du bas,
suivi de ce qui manque pour l'acheter (le palier d'avant, ou la gelée qu'il
faudrait). Sans survol, cette ligne dit où en est la lignée : verrouillée, à
dépenser, ou à attendre.

**La bourse** — la gelée qu'il reste à poser — se lit **en face du compteur de
nœuds**, sur la même ligne, à l'autre bout de l'écran. La barre du haut porte
déjà la gelée, mais c'est ici qu'on la dépense : un prix ne se compare pas à un
nombre qu'il faut aller chercher au-dessus de l'écran.

**Le bouton du Rayon** bat quand une alvéole est payable. **Le bouton _Buy all_**
du Rayon (nœud `busyWax`) n'apparaît **que** lorsqu'il est acquis _et_ qu'au moins
une alvéole est payable : il achète les alvéoles accessibles **de la moins chère à
la plus chère**, sans quoi la première dépense pourrait en priver deux.

**Les relances (« nudges »)** sont les seuls appels à l'action non sollicités du
jeu, et le jeu n'en montre une que lorsque le joueur n'a **aucun moyen de
deviner** le geste attendu. Une flèche ambrée qui va et vient — immobile, elle
se confondrait avec le décor — désigne alors le bouton concerné :

| Relance                                | Condition                                               | S'éteint                      |
| -------------------------------------- | ------------------------------------------------------- | ----------------------------- |
| Flèche sur _Record a run_              | aucun tour enregistré, et pas d'enregistrement en cours | au premier tour enregistré    |
| Flèche + « New upgrade! » sur le Rayon | une alvéole payable **et aucune encore bâtie**          | au premier achat              |
| Flèche sur l'étoile de la Lignée       | un nœud de lignée payable (§7.4)                        | quand plus rien n'est payable |

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
identifiants d'alvéoles, **identifiants des nœuds de lignée acquis** (`lineage`),
meilleur trajet, et l'état de la transformation (lot en
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

Trois garde-fous à la relecture : une alvéole — ou un nœud de lignée — dont
l'identifiant a disparu n'est pas ressuscité ; un trajet qui ne serait pas rejouable est écarté
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
relecture du trajet · **dérive du vol piloté, qui fond avec les améliorations**
(§5.2) · nectar plafonné · le Rayon (**118 alvéoles engendrées** : 8 branches de
début de partie, 9 branches de grind, 7 jalons, 3 pièges et cosmétiques, sur deux
monnaies dont des **prix mixtes**, dévoilement, achats) · **usage du miel** : effectifs et réglages des lots ·
transformation du nectar en miel par lots, sa jauge et ses gains
flottants · gelée royale par paliers · **la Lignée de la Reine** (9 branches, 16
nœuds, essaimage en deux clics, guichet ouvert pour toujours ensuite, héritage
appliqué à la colonie neuve) · HUD complet et infobulles · relances de
première fois (trajet, rayon) et dévoilement du bandeau · écran-titre complet,
transitions, audio, pause · **le périmètre de dépôt tenu par les guerrières** (§7.6, §8) ·
**sauvegarde active** : autosave, reprise, bilan sur
l'écran-titre, invalidation par version · déploiements Pages + itch.

**Manquant, par ordre d'impact design**

1. **Anneau de timing « Perfect »** — la mécanique est le cœur du skill et n'a
   aucun retour visuel autour de la corolle.
2. **La lignée a une fin** — seize nœuds, et l'arbre se solde. Le rayon, lui, en a
   désormais 118 : le grind, les sept jalons et les trois pièges (§7.6 à §7.8)
   tiennent l'horizon bien au-delà de la branche Storage. Il manque toujours un
   horizon au-delà de la **lignée**.
3. SFX du dépôt à la ruche et du « Perfect » ; sprites abeille/fleur/ruche encore
   procéduraux ; migration des couleurs historiques vers la palette.

## 13. Décisions de design écartées (et pourquoi)

| Écarté                                                                      | Raison                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Combo / multiplicateur d'enchaînement** (`systems/Combo.ts`, supprimé)    | Récompensait le pilotage en direct, alors que le jeu automatise le pilotage. Le trajet, jugé au nectar/s, joue ce rôle mieux et une seule fois.                                                                                                                                                 |
| **Plafond de sacoche sur la butineuse**                                     | Se traduisait par des corolles survolées sans effet ni explication. Le plafond est passé à la **ruche**, où il est lisible et améliorable.                                                                                                                                                      |
| **Améliorations de vol généreuses**                                         | Rendre le pilotage facile viderait l'enregistrement de son intérêt. Le gain est volontairement minuscule.                                                                                                                                                                                       |
| **Rayon en pop-up**                                                         | Une parenthèse modale disait « le jeu s'arrête ». Le rayon est un cadre de l'écran de jeu, et le pré tourne dessous.                                                                                                                                                                            |
| **Production de miel passive** (0,5/s/ouvrière, sans intrant)               | Du miel créé à partir de rien : le nectar rapporté ne servait qu'au rayon, et une fois le rayon bâti plus rien ne justifiait de voler. Le miel se transforme désormais depuis la réserve (§6.1).                                                                                                |
| **Taux continu de gelée royale** (0,05 % du miel gagné)                     | Une décimale qui bouge n'est pas un événement. Remplacé par une dose franche tous les 50 miel, annoncée au-dessus de la ruche.                                                                                                                                                                  |
| **Bilan chiffré en bas de colonne** (production, record, reines)            | Trois nombres inertes que personne ne lisait. Remplacés par la porte du Rayon. Le bilan reviendra quand il aura quelque chose à dire.                                                                                                                                                           |
| **Recrutement des castes dans le panneau _Colony_** (`BEE_KINDS.cost`)      | Un second guichet à côté du Rayon : deux endroits pour une seule décision. Les effectifs se paient au rayon comme tout le reste (§6.2), et le panneau reste un état.                                                                                                                            |
| **Un rayon en nectar uniquement**                                           | Le miel se produisait sans jamais se dépenser. Le rayon se paie désormais dans deux monnaies (§6, §7.3) — le vol en nectar, la ruche en miel — et la boucle se ferme.                                                                                                                           |
| **Trois branches en miel tirées vers l'extérieur**                          | Huit bras auraient rendu le rayon illisible sans glissé. Elles remplissent les creux du centre : le rayon s'épaissit au lieu de s'étendre.                                                                                                                                                      |
| **Paliers de réserve à pas fixe** (`storageStep`, 150 par alvéole)          | Six alvéoles et la branche était soldée ; au-delà, un pas constant aurait fait de la quinzième un « +5 % » inaudible. La contenance suit une courbe quadratique (§7.5), raide, sur quinze paliers.                                                                                              |
| **Une branche Storage de cinquante paliers**                                | Premier essai de la refonte quadratique : cinquante alvéoles à cliquer, dont aucune ne pesait vraiment. Quinze paliers sur une courbe deux fois plus raide donnent le même horizon avec quinze décisions au lieu de cinquante.                                                                  |
| **Branche Storage écrite alvéole par alvéole**                              | Les prix sortent d'une formule ; garder les coordonnées à la main rendait tout changement de longueur ou de courbe manuel. La branche est générée, et la règle d'or est vérifiée par le code (§7.5).                                                                                            |
| **Arbre de lignée ouvert seulement après l'essaimage**                      | Il aurait fallu signer le reset sans voir ce qu'on achète. L'arbre se lit à tout moment ; seule la dépense attend le départ de la reine (§7.4).                                                                                                                                                 |
| **Fenêtre de dépense ouverte par l'essaimage, fermée par un second bouton** | Deux boutons pour un seul écran, et une fenêtre qui obligeait à tout dépenser sur-le-champ : impossible de mettre de côté pour un rang III. Un seul bouton (l'essaimage), et le guichet reste ouvert dès la première reine (§7.4).                                                              |
| **Essaimage sur un clic sec**                                               | Le geste détruit une partie entière. Il s'arme d'abord (_Click again to leave_) et se désamorce seul ; une pop-up de confirmation aurait caché l'arbre dont elle parle.                                                                                                                         |
| **Bouton d'essaimage masqué quand rien n'est payable**                      | Un bouton qui disparaît laisse croire à un bug. La gelée n'est plus perdue par l'essaimage : partir tôt reste un choix, pas un piège.                                                                                                                                                           |
| **Lignée pannable et zoomable comme le rayon**                              | Un plan doit se lire d'un coup d'œil : neuf branches tiennent sur un écran, et un arbre qu'on explore au glissé se compare mal à lui-même.                                                                                                                                                      |
| **Un rayon d'environ 250 alvéoles**                                         | Le brief visait 250 nœuds ; les branches de trente et cinquante crans qu'il fallait pour y arriver se lisaient « XXXVII » et s'achetaient sans qu'on choisisse rien. Le plafond est **huit crans** (six pour la moitié), le rayon fait 118 alvéoles, et les prix se durcissent d'autant (§7.6). |
| **Longueurs de branches proportionnelles au brief** (40/24/24/18…)          | Premier essai du plafond : mise à l'échelle des nombres du brief pour tomber sur 250 pile. Les rangs restaient illisibles en chiffres romains. La lisibilité prime sur le total.                                                                                                                |
| **Noms d'améliorations longs** (_Aerodynamics_, _Guard of Honour_…)         | Ils débordaient de l'alvéole et mordaient sur les voisines. L'alvéole est passée de 34 à 40 px de rayon (onze caractères de monogram), et les noms tiennent tous dessous : _Airflow_, _Sentries_, _Brood_, _Waggle_…                                                                            |
| **Une abeille docile dès le premier tour**                                  | Sans dérive ni inertie sérieuse, le pilotage n'avait rien à rendre : le rayon ne vendait que des chiffres. L'abeille nue vole de travers, et chaque cran de vol lui rend un peu de main (§5.2) — c'est le seul progrès qui se sente au geste.                                                   |
| **Bouton _Buy all_ affiché grisé tant qu'il n'est pas acquis**              | Une promesse morte dans un coin du rayon. Il n'existe qu'une fois `busyWax` acquis, et se tait quand rien n'est payable (§8).                                                                                                                                                                   |

---

## Annexe — où sont les chiffres

| Fichier                  | Contenu                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `src/config/balance.ts`  | Abeille, ruche, fleurs et espèces, trajet, économie, castes                                |
| `src/config/upgrades.ts` | Alvéoles du rayon (position, prix, monnaie), la branche Storage générée, effets par niveau |
| `src/ui/format.ts`       | Mise en forme des nombres affichés (`fmt`, `fmtBig`, `fmtCount`)                           |
| `src/config/lineage.ts`  | Branches de la Lignée de la Reine : paliers, prix en gelée, effets                         |
| `src/config/feel.ts`     | Timings d'entités (battement d'ailes, respiration, autosave)                               |
| `src/config/game.ts`     | Version, nom, clé de sauvegarde, dimensions du monde                                       |
| `src/config/strings.ts`  | Textes EN, infobulles, `CREDITS`                                                           |
| `src/ui/theme.ts`        | Palette, polices, découpe de l'écran, feedbacks                                            |
