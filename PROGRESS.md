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
  - `strings.ts` — textes UI (FR)
- `src/ui/theme.ts` — **skin UI** découplé (couleurs, polices, tailles, layout)
- `src/scenes/` — `BootScene`, `TitleScene`, `GameScene`
- `src/entities/` — `Bee` (suivi souris + inertie), `Flower` (cycle d'ouverture)
- `src/systems/` — `GameState` (monnaies + save localStorage), `Combo`
- `src/ui/Hud.ts` — HUD (miel, gelée, nectar, combo, feedbacks flottants)
- `src/gfx/textures.ts` — textures placeholder procédurales (à remplacer)

## État — Jour 1 (socle jouable) ✅

Vérifié de bout en bout dans le navigateur (zéro erreur console) :

- [x] Setup Vite + Phaser + TS, build & type-check OK
- [x] Écran-titre : logo, abeille qui orbite, boutons Butiner/Continuer/Recommencer, version
- [x] Abeille : suivi souris avec inertie + orientation vers la direction de vol, ailes animées
- [x] Fleurs : cycle bourgeon → mi-ouvert → ouvert, qualités variables, cooldown de recharge
- [x] Butinage → nectar + combo (multiplicateur croissant)
- [x] Dépôt à la ruche → miel (× multiplicateur de combo)
- [x] Gelée royale qui s'accumule (fraction du miel)
- [x] HUD complet + feedbacks « +N » / « Parfait ! » + particules de pollen
- [x] Sauvegarde localStorage + autosave + rechargement

## Reste à faire

**Jour 1 (fin)**
- [ ] Ouvrières (production passive) + `HivePanel` (overlay) + `Upgrades` (achats miel)

**Assets**
- [ ] Porter tout le jeu sur la palette officielle (cf. `CLAUDE.md`) : `src/ui/theme.ts`
      et la palette pixel de `src/gfx/textures.ts` utilisent encore des teintes hors palette
- [ ] Remplacer les placeholders par les vrais PNG (tileset Tiny Garden, `objects.png`)
- [ ] Créer le sprite d'abeille custom 16×16

**Jour 2**
- [ ] Anneau de timing « Parfait » autour des fleurs
- [ ] Prestige : gelée royale → reset + arbre de reines
- [ ] Charme AV : sons (400 Sounds Pack), musiques (Old Tavern / Moonlit Vale / March of Iron)
- [ ] Déploiement GitHub Pages (workflow Actions) + publication itch.io

## Note dev

En mode dev, le jeu est exposé sur `window.__game` pour l'inspection/tests.
