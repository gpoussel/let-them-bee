import Phaser from 'phaser'
import { BEE } from '../config/balance'
import { FEEL } from '../config/feel'
import { STR } from '../config/strings'
import { HEX, COLORS, FONTS, PALETTE, SCREEN } from '../ui/theme'
import { pixelText } from '../ui/text'
import { TEX } from '../gfx/textures'
import { Bee } from '../entities/Bee'
import { Flower } from '../entities/Flower'
import { gameState } from '../systems/GameState'
import { RoutePlayer, RouteRecorder, type Route } from '../systems/Route'
import { FlowerField } from '../systems/FlowerField'
import { Hud } from '../ui/Hud'
import { HoneyGauge } from '../ui/HoneyGauge'
import { fmtFine } from '../ui/format'
import { audio, SND } from '../systems/Audio'
import { transitionIn, TRANSITION_MS } from '../gfx/transition'

/** Données passées à la scène : d'où l'on arrive (pilote la transition). */
interface SceneData {
  fromTitle?: boolean
}

// Profondeurs du pré. Tout y est NÉGATIF : l'interface, elle, reste à la
// profondeur par défaut et passe donc au-dessus quoi qu'il arrive.
const DEPTH = {
  garden: -100,
  border: -90,
  flowers: -50,
  bee: -40,
  pollen: -30,
} as const

/** Marge entre le cadre du pré et la zone où l'abeille peut voler. */
const FIELD_INSET = 26
/** Longueur des équerres d'angle du cadre du pré. */
const CORNER = 12
/**
 * Échelle des fleurs. ENTIÈRE, et elle doit le rester : la planche Tiny Garden
 * est du pixel art de 16 px, qu'un facteur fractionnaire déforme aussitôt
 * (certains pixels rendus sur 2 points d'écran, leurs voisins sur 1).
 */
const FLOWER_SCALE = 2
/**
 * Échelle de l'abeille. Sa texture est bakée à 2 points par pixel d'art (cf.
 * gfx/textures) : à 0,5 elle en fait donc UN. C'est la seule chose du pré à
 * cette densité, et c'est assumé — une butineuse doit se glisser entre les
 * corolles, pas les écraser. Facteur exact (moitié pile), aucun pixel n'est
 * rendu à cheval.
 */
const BEE_SCALE = 0.5
/** Distance de dépôt à la ruche, en px. */
const HIVE_RADIUS = 46
/** Rayon autour de la ruche où aucune fleur ne pousse. */
const HIVE_CLEARANCE = 80
/**
 * Hauteur de la corolle au-dessus de la base du pied : c'est LÀ qu'on butine,
 * pas au ras du sol (les fleurs sont posées par leur tige).
 */
const REACH_RISE = 44
/** Où l'abeille se pose quand elle n'a rien à faire : à côté de la ruche, pas dessus. */
const PERCH = { dx: -46, dy: -10 } as const
/** Période minimale entre deux « Full! » : un par corolle saturerait l'écran. */
const FULL_POP_MS = 900
/**
 * Atténuation du son de butinage quand le trajet est rejoué. Le tour tourne en
 * boucle sans le joueur : à plein volume il deviendrait un métronome. Pendant un
 * enregistrement, au contraire, chaque fleur prise est un geste du joueur — elle
 * s'entend en entier.
 */
const FORAGE_REPLAY_GAIN = 0.35

/**
 * Mode du pré :
 *   - `idle`      : aucun trajet enregistré — la butineuse attend sur la ruche
 *                   et il ne se passe rien, c'est voulu ;
 *   - `replay`    : le meilleur trajet connu est rejoué en boucle, sans le
 *                   joueur — c'est l'état normal du jeu ;
 *   - `recording` : le joueur pilote pour proposer un nouveau tour.
 */
type Mode = 'idle' | 'replay' | 'recording'

// Scène de jeu principale.
//
// Le vol n'est pas le jeu : c'est l'itération que l'on enregistre une fois, et
// que la butineuse répète ensuite indéfiniment. Le joueur ne reprend les
// commandes que pour tenter un meilleur tour (cf. systems/Route).
export class GameScene extends Phaser.Scene {
  private bee!: Bee
  private fieldFlowers!: FlowerField
  private flowers: Flower[] = []
  private hive!: Phaser.GameObjects.Sprite
  private hud!: Hud
  private honeyGauge!: HoneyGauge
  private autosaveTimer = 0
  /** Zone de vol : le pré, moins la marge du cadre. */
  private field!: Phaser.Geom.Rectangle

  private mode: Mode = 'idle'
  private recorder: RouteRecorder | null = null
  private player: RoutePlayer | null = null
  /** Nectar déposé depuis le début de l'enregistrement en cours. */
  private recordedNectar = 0
  /** Temps restant avant de pouvoir re-signaler que la butineuse est pleine, en ms. */
  private fullPopTimer = 0
  /**
   * Accélérateur des OUTILS DE DÉVELOPPEMENT (cf. `devContext`). Toujours 1 en
   * jeu : rien ici ne le change, seul le menu de triche y touche.
   */
  private timeScale = 1

  constructor() {
    super('Game')
  }

  create(): void {
    // Fond : la prairie bakée au boot — mêmes tuiles que l'écran-titre, mais
    // nue. Aucune fleur : les seules de l'écran sont celles que l'on butine.
    this.add.image(0, 0, TEX.gardenField).setOrigin(0, 0).setDepth(DEPTH.garden)

    const { x, y, w, h } = SCREEN.field
    this.field = new Phaser.Geom.Rectangle(
      x + FIELD_INSET,
      y + FIELD_INSET,
      w - FIELD_INSET * 2,
      h - FIELD_INSET * 2,
    )
    this.drawFieldFrame()

    // Ruche (départ et arrivée du trajet), dans le coin bas-droit du pré.
    this.hive = this.add.sprite(x + w - 60, y + h - 64, TEX.hive).setDepth(DEPTH.flowers)
    pixelText(this, this.hive.x, this.hive.y + 34, STR.hive, FONTS.sizeHint, HEX.cream)
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.flowers)

    // Le pré : des emplacements semés une fois pour toutes, dont le calendrier
    // est identique à chaque tour (cf. systems/FlowerField).
    this.fieldFlowers = this.makeFlowerField()
    this.flowers = this.fieldFlowers.slots.map(
      (slot) => new Flower(this, slot, FLOWER_SCALE, DEPTH.flowers),
    )

    // Le tube de transformation, planté sur le toit de la ruche (cf. HoneyGauge).
    this.honeyGauge = new HoneyGauge(this, this.hive.x, this.hive.y - this.hive.height / 2)

    this.bee = new Bee(this, this.hive.x + PERCH.dx, this.hive.y + PERCH.dy)
    this.bee.setScale(BEE_SCALE).setDepth(DEPTH.bee)

    this.hud = new Hud(this, {
      onToggleRecord: () => {
        this.toggleRecord()
      },
      onOpenComb: () => this.scene.launch('Comb'),
    })

    // Le pointeur ne pilote QUE pendant un enregistrement. La cible est ramenée
    // dans le pré : l'abeille n'en sort jamais, même quand le pointeur part
    // survoler l'interface.
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.mode !== 'recording') return
      this.bee.setTarget(
        Phaser.Math.Clamp(p.worldX, this.field.left, this.field.right),
        Phaser.Math.Clamp(p.worldY, this.field.top, this.field.bottom),
      )
    })

    // Escape : menu de pause en surimpression. Le rayon, lui, est une scène à
    // part et coupe les entrées d'ici tant qu'il est ouvert — c'est donc LUI qui
    // reçoit l'échappement quand il est là.
    this.input.keyboard?.on('keydown-ESC', () => {
      this.scene.pause()
      this.scene.launch('Pause')
    })

    // Au démarrage : on rejoue le meilleur tour connu, s'il y en a un.
    this.enterReplayOrIdle()

    // Musique du potager : no-op si la transition depuis le titre l'a déjà
    // lancée en fondu.
    audio.playMusic(SND.gameTheme, TRANSITION_MS)

    // Ouverture en nid d'abeille quand on arrive depuis l'écran-titre.
    if ((this.scene.settings.data as SceneData | undefined)?.fromTitle) transitionIn(this)
  }

  /**
   * Sème un pré : mêmes bornes, même graine, donc RIGOUREUSEMENT le même
   * calendrier à chaque appel (cf. systems/FlowerField).
   */
  private makeFlowerField(): FlowerField {
    return new FlowerField(
      {
        left: this.field.left,
        top: this.field.top,
        right: this.field.right,
        bottom: this.field.bottom,
      },
      { x: this.hive.x, y: this.hive.y, radius: HIVE_CLEARANCE },
    )
  }

  /**
   * Prise des OUTILS DE DÉVELOPPEMENT (cf. src/dev, chargés en dev seulement) :
   * la géométrie du pré, un pré de simulation jetable, et de quoi imposer un
   * trajet. Rien du jeu n'appelle ceci.
   */
  devContext() {
    return {
      hive: { x: this.hive.x, y: this.hive.y },
      origin: { x: this.field.left, y: this.field.top },
      reachRise: REACH_RISE,
      // Même tolérance que la boucle de butinage ci-dessous.
      forageRadius: this.bee.forageRadius + 10,
      speed: BEE.maxSpeed * gameState.flightMult,
      growthMult: gameState.growthMult,
      newField: () => this.makeFlowerField(),
      timeScale: () => this.timeScale,
      /**
       * Accélère TOUT ce qui dépend du temps ici : le calendrier du pré, le vol,
       * la transformation, le compteur d'enregistrement. Un seul point d'entrée
       * (le `delta` de `update`), sinon les horloges divergeraient et le pré ne
       * serait plus déterministe vis-à-vis du trajet rejoué.
       */
      setTimeScale: (mult: number) => {
        this.timeScale = mult
        // Les feedbacks (textes flottants, pollen) suivent : à x4, des pops qui
        // durent leur temps normal s'empileraient à l'écran.
        this.tweens.timeScale = mult
      },
      applyRoute: (route: Route) => {
        // Imposé, pas proposé : un trajet d'outil n'a pas à battre le précédent.
        gameState.route = route
        gameState.save()
        this.enterReplayOrIdle('Dev route')
      },
    }
  }

  /**
   * Cadre du pré : un liseré et quatre équerres d'angle. Rien d'opaque — la
   * prairie doit rester visible, c'est le terrain de jeu.
   */
  private drawFieldFrame(): void {
    const { x, y, w, h } = SCREEN.field
    const g = this.add.graphics().setDepth(DEPTH.border)

    g.lineStyle(2, PALETTE.oliveBrown, 0.9)
    g.strokeRect(x + 1, y + 1, w - 2, h - 2)

    g.lineStyle(2, PALETTE.amber, 1)
    const corners: [number, number, number, number][] = [
      [x + 1, y + 1, 1, 1],
      [x + w - 1, y + 1, -1, 1],
      [x + 1, y + h - 1, 1, -1],
      [x + w - 1, y + h - 1, -1, -1],
    ]
    for (const [cx, cy, sx, sy] of corners) {
      g.lineBetween(cx, cy, cx + sx * CORNER, cy)
      g.lineBetween(cx, cy, cx, cy + sy * CORNER)
    }
  }

  // --- Modes -----------------------------------------------------------------

  /**
   * Reprend le trajet enregistré, ou retombe à l'attente s'il n'y en a pas.
   *
   * @param verdict bilan du tour qui vient de se clore, le cas échéant. Il est
   * affiché PAR-DESSUS la consigne permanente et s'efface de lui-même : la
   * consigne, elle, décrit l'état du pré et doit lui survivre.
   */
  private enterReplayOrIdle(verdict = ''): void {
    this.recorder = null
    const route = gameState.route
    if (route) {
      this.player = new RoutePlayer(route, this.field.left, this.field.top)
      // Le tour repart de son premier instant : mêmes fleurs, mêmes ouvertures.
      this.fieldFlowers.reset()
      this.mode = 'replay'
      this.hud.setRecordLabel(STR.recordAgain)
      this.hud.setMessage(STR.controlsHint)
    } else {
      this.player = null
      this.mode = 'idle'
      this.bee.setTarget(this.hive.x + PERCH.dx, this.hive.y + PERCH.dy)
      this.hud.setRecordLabel(STR.record)
      this.hud.setMessage(STR.noRoute)
    }
    if (verdict) this.hud.flashMessage(verdict)
  }

  /** Bouton du bandeau : lancer un tour, ou abandonner celui en cours. */
  private toggleRecord(): void {
    if (this.mode === 'recording') {
      this.enterReplayOrIdle()
      return
    }
    // Départ propre : l'abeille repart de la ruche, les mains vides.
    this.player = null
    this.bee.moveTo(this.hive.x + PERCH.dx, this.hive.y + PERCH.dy)
    this.bee.nectar = 0
    this.recordedNectar = 0
    // Le pré repart de zéro : c'est ce qui rend deux tours comparables. Le
    // joueur retrouve exactement les mêmes fleurs aux mêmes secondes.
    this.fieldFlowers.reset()
    this.recorder = new RouteRecorder(this.field.left, this.field.top)
    this.mode = 'recording'
    this.hud.setRecordLabel(STR.stopRecording)
    this.hud.setMessage(STR.recordingHint)
  }

  /**
   * Clôt le tour en cours : il est comparé au meilleur connu et ne le remplace
   * que s'il rapporte plus de nectar par seconde.
   */
  /** @param timeUp le tour est clos par le couperet des 10 s, pas par le joueur */
  private finishRecording(timeUp = false): void {
    const route = this.recorder?.finish(this.recordedNectar) ?? null
    if (!route) {
      this.enterReplayOrIdle(timeUp ? STR.timeUp : STR.runTooShort)
      return
    }
    const adopted = gameState.proposeRoute(route)
    gameState.save()
    const verdict = adopted ? STR.newBest : STR.keptOld
    this.enterReplayOrIdle(timeUp ? `${STR.timeUp} ${verdict}` : verdict)
  }

  update(_time: number, rawDelta: number): void {
    // Point d'entrée UNIQUE du temps de la scène : tout ce qui suit lit `delta`,
    // donc l'accélérateur des outils de dev (x2, x4) s'applique partout à la
    // fois — pré, vol, transformation, compteur — ou nulle part.
    const delta = rawDelta * this.timeScale
    const dt = delta / 1000

    this.tickHoney(dt)

    // L'horloge du pré avance AVANT le vol : la position de l'abeille et l'état
    // des fleurs se lisent au même instant, en relecture comme à l'enregistrement.
    // Le calendrier tourne à la vitesse qu'ont payée les améliorations de
    // pousse : accélérer le pré, c'est raccourcir l'attente entre deux corolles.
    this.fieldFlowers.advance(delta * gameState.growthMult)
    this.bee.speedMult = gameState.flightMult

    if (this.fullPopTimer > 0) this.fullPopTimer -= delta

    if (this.mode === 'recording') this.tickRecording(delta)
    else if (this.mode === 'replay') this.tickReplay(delta)

    // Butinage et dépôt tournent dans les deux cas : le trajet rejoué récolte
    // pour de vrai, ce n'est pas une animation par-dessus un gain forfaitaire.
    if (this.mode !== 'idle') {
      this.fieldFlowers.slots.forEach((slot, i) => {
        const d = Phaser.Math.Distance.Between(this.bee.x, this.bee.y, slot.x, slot.y - REACH_RISE)
        if (d > this.bee.forageRadius + 10) return
        this.tryForage(i, slot.x, slot.y)
      })
      const dHive = Phaser.Math.Distance.Between(this.bee.x, this.bee.y, this.hive.x, this.hive.y)
      if (dHive < HIVE_RADIUS && this.bee.nectar > 0) this.deposit()
    }

    // Affichage du pré, en dernier : les fleurs butinées cette frame ont déjà
    // disparu du calendrier.
    this.flowers.forEach((f, i) => {
      f.sync(this.fieldFlowers.stateOf(i))
    })

    this.honeyGauge.update()
    this.hud.update(this.mode === 'recording')
    this.hud.setElapsed(this.mode === 'recording' ? (this.recorder?.durationMs ?? 0) : null)

    this.autosaveTimer += delta
    if (this.autosaveTimer >= FEEL.autosaveMs) {
      this.autosaveTimer = 0
      gameState.save()
    }
  }

  private tickRecording(delta: number): void {
    const rec = this.recorder
    if (!rec) return
    rec.sample(this.bee.x, this.bee.y, delta)
    // Couperet : à 10 s le tour est clos en l'état, que la butineuse soit
    // rentrée ou non. Un tour rejoué en boucle doit être court.
    if (rec.overrun) this.finishRecording(true)
  }

  private tickReplay(delta: number): void {
    const player = this.player
    if (!player) return
    const { x, y, looped } = player.advance(delta)
    // Chaque tour rejoue le même pré : le trajet enregistré retrouve les fleurs
    // exactement dans l'état où il les avait trouvées.
    if (looped) this.fieldFlowers.reset()
    // En relecture, l'abeille suit le trajet au pixel : pas d'inertie, sinon
    // elle couperait les virages et manquerait les fleurs qu'elle visait.
    this.bee.moveTo(x, y)
    // Un tour se solde à la ruche : si la butineuse rentre les pattes pleines
    // (fleur en recharge, trajet modifié), le nectar est versé au bouclage.
    if (looped && this.bee.nectar > 0) this.deposit()
  }

  private tryForage(index: number, x: number, y: number): void {
    // Réserve pleine : la corolle est ouverte, le passage est bon, et pourtant
    // rien ne rentrera. Sans un mot, ça se lit comme une fleur ratée par le jeu
    // — donc on le dit, sur la fleur concernée. Pendant un enregistrement, en
    // revanche, aucun plafond ne s'applique (cf. `deposit`).
    if (this.mode !== 'recording' && gameState.nectar >= gameState.nectarCapacity) {
      if (this.fieldFlowers.stateOf(index).phase === 'bloom' && this.fullPopTimer <= 0) {
        this.fullPopTimer = FULL_POP_MS
        this.hud.popText(x, y - 56, STR.full, HEX.alert)
      }
      return
    }
    const { nectar, perfect } = this.fieldFlowers.harvest(index)
    if (nectar <= 0) return

    this.bee.nectar += nectar

    audio.playSfx(SND.forage, this.mode === 'recording' ? 1 : FORAGE_REPLAY_GAIN)
    this.hud.popText(
      x,
      y - 56,
      perfect ? `${STR.perfect} +${nectar}` : `+${nectar}`,
      perfect ? HEX.perfect : HEX.cream,
    )
    this.spawnPollen(x, y - REACH_RISE)
  }

  private deposit(): void {
    const gained = this.bee.nectar
    this.bee.nectar = 0

    if (this.mode === 'recording') {
      // Un enregistrement est un BANC D'ESSAI, pas une récolte : rien n'entre
      // dans la ruche, et aucun plafond ne vient fausser la note. Seul compte
      // ce que le tour rapporterait, pour le comparer au tour de référence.
      this.recordedNectar += gained
      this.hud.popText(this.hive.x, this.hive.y - 40, `+${Math.floor(gained)}`, HEX.cream)
      // Rentrer avec du nectar clôt le tour, TOUJOURS. Un tour très court n'est
      // pas un tour invalide (le critère est le nectar par seconde) ; et même
      // battu, il doit se solder par un verdict, sinon le joueur reste en vol
      // sans savoir que sa boucle est déjà jugée.
      this.finishRecording()
      return
    }

    // La butineuse rentre du NECTAR — c'est la ruche qui en fera du miel. Ce
    // qui dépasse la réserve est perdu, et on le dit plutôt que de l'escamoter.
    //
    // Les butineuses supplémentaires (nœud « foragers ») volent le même trajet
    // sans être dessinées : une seule abeille à l'écran reste lisible, et le
    // tour de référence est le même pour toutes.
    const carried = gained * gameState.bees.forager
    const stored = gameState.addNectar(carried)
    const full = stored < carried
    this.hud.popText(
      this.hive.x,
      this.hive.y - 40,
      full ? STR.full : `+${Math.floor(stored)} ${STR.nectar}`,
      full ? HEX.alert : HEX.cream,
    )
  }

  /**
   * Transformation du nectar en miel. Le moteur fait les comptes (cf.
   * `GameState.tickHoney`) ; ici on l'annonce, au-dessus de la ruche.
   *
   * Un lot rend peu de miel et le miel rend encore moins de gelée royale : les
   * deux gains ne tombent donc pas ensemble, et chacun sort avec son pot pour
   * qu'on ne les confonde pas.
   */
  private tickHoney(dt: number): void {
    const gained = gameState.tickHoney(dt)
    if (!gained) return

    audio.playSfx(SND.honey)
    const top = this.honeyGauge.topY
    this.hud.popGain(
      this.hive.x,
      top - 12,
      TEX.iconHoney,
      `+${fmtFine(gained.honey)}`,
      PALETTE.amber,
      HEX.honey,
    )
    // La gelée royale n'arrive qu'un lot sur beaucoup : elle sort plus haut,
    // pour ne pas se poser sur le pot de miel du même instant.
    if (gained.jelly > 0) {
      this.hud.popGain(
        this.hive.x,
        top - 44,
        TEX.iconJelly,
        `+${fmtFine(gained.jelly)}`,
        COLORS.cream,
        HEX.jelly,
      )
    }
  }

  private spawnPollen(x: number, y: number): void {
    for (let i = 0; i < 5; i++) {
      const p = this.add.image(x, y, TEX.pollen).setDepth(DEPTH.pollen)
      this.tweens.add({
        targets: p,
        x: x + Phaser.Math.Between(-24, 24),
        y: y + Phaser.Math.Between(-24, 24),
        alpha: 0,
        duration: 500,
        onComplete: () => {
          p.destroy()
        },
      })
    }
  }
}
