# Avancement — Let Them Bee (DTJ36)

Jeu incrémental navigateur où **le skill accélère la progression**. Pilotez l'abeille à la souris,
butinez au bon timing pour enchaîner les combos, faites grandir la ruche.

Stack : **Phaser 3 + Vite + TypeScript**. Voir le GDD complet pour le design détaillé.

## Lancer le projet

```bash
npm install
npm run dev          # http://localhost:5173/let-them-bee/
npm run build        # build GitHub Pages (base /let-them-bee/)
npm run build:itch   # build itch.io (base relative ./)
```

## Architecture

Séparation stricte **moteur / skin UI** (une autre version peut réutiliser le moteur avec un autre thème) :

- `src/config/` — **moteur** (aucune valeur en dur ailleurs)
  - `game.ts` — version, nom, dimensions du monde
  - `balance.ts` — tuning gameplay (vitesses, combo, économie, coûts)
  - `feel.ts` — timings des entités (battement d'ailes, respiration, autosave)
  - `strings.ts` — textes UI (EN) + liste `CREDITS`
- `src/ui/theme.ts` — **skin UI** découplé (couleurs, polices, tailles, layout)
- `src/scenes/` — `BootScene`, `TitleScene`, `GameScene`, `PauseScene`
- `src/entities/` — `Bee` (suivi souris + inertie), `Flower` (cycle d'ouverture)
- `src/systems/` — `GameState` (monnaies + save localStorage), `Combo`, `Audio`, `Settings`
- `src/ui/` — `Hud`, `pixui` (widgets), `prefsPanel`, `cursor`, `text`
- `src/gfx/` — `font` (monogram bitmap), `logo`, `garden` (tileset Tiny Garden),
  `ui9` (nine-slice), `transition` (nid d'abeille), `textures.ts` (placeholders procéduraux,
  encore utilisés pour l'abeille / les fleurs / la ruche)

## Fait ✅

**Socle jouable**

- [x] Setup Vite + Phaser + TS, build & type-check OK
- [x] Abeille : suivi souris avec inertie + orientation vers la direction de vol, ailes animées
- [x] Fleurs : cycle bourgeon → mi-ouvert → ouvert, qualités variables, cooldown de recharge
- [x] Butinage → nectar + combo (multiplicateur croissant), fenêtre « Perfect » côté logique
- [x] Dépôt à la ruche → miel (× multiplicateur de combo)
- [x] Gelée royale qui s'accumule (fraction du miel)
- [x] HUD complet + feedbacks « +N » / « Perfect! » + particules de pollen
- [x] Sauvegarde localStorage + autosave + rechargement
- [x] Production passive des ouvrières (`GameState.tickWorkers`) — *côté moteur uniquement*

**Écran-titre & habillage**

- [x] Logo animé, jardin en tileset, curseurs custom, UI nine-slice, pied de page + liens
- [x] Pop-up crédits (`CREDITS` dans `strings.ts`) + panneau de réglages (volumes musique / SFX)
- [x] Transition titre ↔ jeu en nid d'abeille + fondu musical, menu de pause (Échap)
- [x] Audio : musiques titre & potager, son de clic UI, fondus croisés, persistance des volumes
- [x] Textes UI passés en anglais

**Déploiement**

- [x] GitHub Pages (`.github/workflows/deploy-pages.yml`) et itch.io (`deploy-itch.yml`) — vérifiés en ligne

## Reste à faire

**Gameplay — le plus gros manque**
- [ ] `HivePanel` (overlay ruche) + `Upgrades` : rien ne permet aujourd'hui *d'acheter*
      des ouvrières ni des améliorations — le champ `workers` existe mais reste à 0
- [ ] Prestige : gelée royale → reset + arbre de reines (`queens` est sauvegardé mais inutilisé)
- [ ] Anneau de timing « Perfect » autour des fleurs (la mécanique existe, le retour visuel non)

**Assets**
- [ ] Palette officielle (cf. `CLAUDE.md`) : `src/ui/theme.ts` (cream, honey, amber, bgDark,
      grassA/B, comboLow, perfect, jelly…) et la palette pixel de `src/gfx/textures.ts`
      sont encore hors palette
- [ ] Scène de jeu encore en placeholders : gazon en damier tracé par `drawField()` au lieu du
      tileset Tiny Garden déjà chargé, sprites abeille / fleur / ruche procéduraux
- [ ] Créer le sprite d'abeille custom 16×16

**Charme AV**
- [ ] SFX de gameplay : butinage, dépôt, « Perfect », montée de combo (seul `ui-click` existe)
- [ ] Musique dédiée au potager si besoin (aujourd'hui une seule piste in-game)

## Note dev

En mode dev, le jeu est exposé sur `window.__game` pour l'inspection/tests.
