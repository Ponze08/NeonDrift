import * as THREE from 'three';
import { CameraController } from '../camera/CameraController';
import { CHARACTER_DEFINITIONS, COSMETIC_DEFINITIONS } from '../data/characters';
import { MissionType } from '../data/missions';
import { InputAction } from '../input/InputAction';
import { InputManager } from '../input/InputManager';
import { CollisionOutcome, Player, type PlayerEvent } from '../player/Player';
import { AudioManager, SoundEffect } from '../systems/AudioManager';
import { EconomyManager, type EconomyResult } from '../systems/EconomyManager';
import { MissionManager, type MissionProgressUpdate } from '../systems/MissionManager';
import { ParticleManager } from '../systems/ParticleManager';
import { ProgressionManager } from '../systems/ProgressionManager';
import { SaveManager, type GameSettings, type SaveData } from '../systems/SaveManager';
import { ScoreManager, type ScoreSnapshot } from '../systems/ScoreManager';
import { UIManager } from '../ui/UIManager';
import type {
  GameOverSummary,
  HUDSnapshot,
  MainMenuData,
  MissionProgressSnapshot,
  PowerUpIndicator,
  UISettings,
} from '../ui/types';
import { PowerUpType, POWER_UP_DEFINITIONS } from '../entities/PowerUp';
import { WorldManager } from '../world/WorldManager';
import { GAME_CONFIG } from './Config';
import { GameLoop } from './GameLoop';
import { GameState, GameStateMachine } from './GameState';

interface RunTelemetry {
  jumps: number;
  slides: number;
  laneChanges: number;
  powerUps: number;
  hoverBreaks: number;
}

const EMPTY_RUN_TELEMETRY = (): RunTelemetry => ({
  jumps: 0,
  slides: 0,
  laneChanges: 0,
  powerUps: 0,
  hoverBreaks: 0,
});

const POWER_UP_LABELS: Readonly<Record<PowerUpType, string>> = {
  [PowerUpType.CoinMagnet]: 'Flux Magnet',
  [PowerUpType.EnergyShield]: 'Pulse Shield',
  [PowerUpType.ScoreBooster]: 'Prism Booster',
  [PowerUpType.SkyBoots]: 'Sky Boots',
  [PowerUpType.DashMode]: 'Nova Dash',
};

function colourToCss(colour: number): string {
  return `#${colour.toString(16).padStart(6, '0')}`;
}

function playerTitle(level: number): string {
  if (level >= 20) return 'Zenith Legend';
  if (level >= 12) return 'Aurora Ace';
  if (level >= 6) return 'Skyline Drifter';
  if (level >= 3) return 'Circuit Courier';
  return 'Rookie Drifter';
}

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(61, 1, 0.1, 260);
  private readonly cameraController: CameraController;
  private readonly world: WorldManager;
  private readonly particles: ParticleManager;
  private readonly input: InputManager;
  private readonly audio = new AudioManager();
  private readonly ui = new UIManager();
  private readonly saves = new SaveManager();
  private readonly economy = new EconomyManager(this.saves);
  private readonly score = new ScoreManager();
  private readonly state = new GameStateMachine();
  private readonly loop: GameLoop;
  private readonly speedLinePosition = new THREE.Vector3();
  private readonly fixedSeed = new URLSearchParams(window.location.search).get('seed');

  private player!: Player;
  private missions!: MissionManager;
  private progression!: ProgressionManager;
  private saveData!: SaveData;
  private telemetry = EMPTY_RUN_TELEMETRY();
  private countdownRemaining = 0;
  private countdownDisplay = '';
  private crashDelay = 0;
  private runFinalized = true;
  private runSequence = 0;
  private hudAccumulator = 0;
  private missionAccumulator = 0;
  private missionDistancePending = 0;
  private missionTimePending = 0;
  private autosaveAccumulator = 0;
  private speedLineAccumulator = 0;
  private missionNoticeRemaining = 0;
  private lastMissionNoticeId = '';
  private contextLost = false;
  private destroyed = false;

  public constructor() {
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
    if (canvas === null) throw new Error('The game canvas is missing.');
    this.canvas = canvas;
    this.saveData = this.saves.load();

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.saveData.settings.graphicsQuality !== 'low',
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.world = new WorldManager(this.scene, {
      graphicsQuality: this.saveData.settings.graphicsQuality,
      laneSpacing: GAME_CONFIG.player.laneSpacing,
    });
    this.particles = new ParticleManager(this.scene, {
      enabled: this.saveData.settings.particleEffects,
    });
    this.createPlayer();
    this.cameraController = new CameraController(this.camera, {
      shakeEnabled: this.saveData.settings.cameraShake,
    });
    this.cameraController.reset(this.player);
    this.input = new InputManager(canvas, {
      swipeThreshold: this.swipePixels(this.saveData.settings),
      inputCooldown: GAME_CONFIG.input.inputCooldown,
    });
    this.input.attach();
    this.rebuildPersistentManagers();
    this.bindUI();
    this.applySettings(this.toUISettings(this.saveData.settings), false);
    this.world.reset(this.fixedSeed ?? 'neon-drift-preview');
    this.resize();

    this.loop = new GameLoop(this.update, GAME_CONFIG.performance.maximumDeltaSeconds);
    window.addEventListener('resize', this.resize, { passive: true });
    window.addEventListener('orientationchange', this.resize, { passive: true });
    this.canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    this.audio.bindAutoUnlock(document);
  }

  public async start(): Promise<void> {
    this.loop.start();
    this.ui.showLoading(0.12, 'Building the skyline…');
    await this.nextFrame();
    this.renderer.compile(this.scene, this.camera);
    this.ui.setLoadingProgress(0.58, 'Charging Prism lanes…');
    await this.nextFrame();
    this.ui.setLoadingProgress(0.86, 'Syncing courier uplink…');
    await this.nextFrame();
    this.ui.setLoadingProgress(1, 'Skyline ready', true);
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.persistProgress();
    this.loop.dispose();
    this.input.destroy();
    this.ui.destroy();
    this.audio.dispose();
    this.particles.dispose();
    this.world.dispose();
    this.disposePlayer(this.player);
    this.renderer.dispose();
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('orientationchange', this.resize);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
  }

  private bindUI(): void {
    this.ui.on('enter', () => {
      void this.audio.unlock();
      this.audio.startMusic();
      this.audio.play(SoundEffect.Button);
      if (this.state.transition(GameState.MainMenu, 'loading-complete')) this.showMainMenu();
    });
    this.ui.on('start', () => {
      this.audio.play(SoundEffect.Button);
      this.startRun();
    });
    this.ui.on('pause', () => this.pause());
    this.ui.on('resume', () => this.resume());
    this.ui.on('restart', () => this.restartRun());
    this.ui.on('mainMenu', () => this.returnToMainMenu());
    this.ui.on('activateHover', () => this.activateHoverDevice());
    this.ui.on('settingsChange', (settings) => this.applySettings(settings, true));
    this.ui.on('characterAction', ({ id, action }) => {
      const result =
        action === 'buy' ? this.economy.purchaseCharacter(id) : this.economy.equipCharacter(id);
      this.handleEconomyResult(result, action === 'buy' ? 'Runner unlocked' : 'Runner equipped');
      if (result.ok && action === 'equip') this.createPlayer();
    });
    this.ui.on('equipmentAction', ({ id, action }) => {
      const result =
        action === 'buy' ? this.economy.purchaseCosmetic(id) : this.economy.equipCosmetic(id);
      this.handleEconomyResult(
        result,
        action === 'buy' ? 'Equipment unlocked' : 'Equipment equipped',
      );
      if (result.ok && action === 'equip') this.createPlayer();
    });
    this.ui.on('buyHoverDevice', (cost) => {
      this.handleEconomyResult(this.economy.purchaseHoverDevice(cost), 'Fluxboard added');
    });
    this.ui.on('resetSave', () => this.resetSave());
  }

  private readonly update = (deltaSeconds: number): void => {
    if (this.destroyed || this.contextLost) return;
    this.input.drain(this.handleInput);

    if (this.state.is(GameState.Countdown)) this.updateCountdown(deltaSeconds);
    else if (this.state.is(GameState.Running)) this.updateRunning(deltaSeconds);

    if (!this.state.is(GameState.Paused)) {
      this.particles.update(deltaSeconds);
      this.cameraController.update(deltaSeconds, this.player, this.player.currentSpeed);
    }
    this.renderer.render(this.scene, this.camera);
  };

  private readonly handleInput = (action: InputAction): void => {
    if (action === InputAction.Pause) {
      if (this.state.is(GameState.Running)) this.pause();
      else if (this.state.is(GameState.Paused)) this.resume();
      return;
    }
    if (action === InputAction.Restart) {
      if (this.state.is(GameState.GameOver) || this.state.is(GameState.Paused)) this.restartRun();
      return;
    }
    if (action === InputAction.ActivateHoverDevice) {
      if (this.state.is(GameState.Running)) this.activateHoverDevice();
      return;
    }
    if (this.state.is(GameState.Running) && this.crashDelay <= 0) this.player.handleAction(action);
  };

  private updateCountdown(deltaSeconds: number): void {
    this.countdownRemaining -= deltaSeconds;
    const nextDisplay =
      this.countdownRemaining <= 0.42
        ? 'GO'
        : String(Math.max(1, Math.ceil(this.countdownRemaining)));
    if (nextDisplay !== this.countdownDisplay) {
      this.countdownDisplay = nextDisplay;
      this.ui.setCountdown(nextDisplay, nextDisplay === 'GO' ? 'Ride the light' : 'Get ready');
      if (nextDisplay === 'GO') this.audio.play(SoundEffect.Button);
    }
    if (this.countdownRemaining > 0) return;
    if (this.state.transition(GameState.Running, 'countdown-complete')) {
      this.ui.showHUD(this.hudSnapshot(this.score.snapshot));
    }
  }

  private updateRunning(deltaSeconds: number): void {
    if (this.crashDelay > 0) {
      this.crashDelay = Math.max(0, this.crashDelay - deltaSeconds);
      this.player.update(deltaSeconds, 0);
      this.world.update(deltaSeconds, this.player, this.score.snapshot.distance);
      if (this.crashDelay === 0) this.completeRun(true, true);
      return;
    }

    const before = this.score.snapshot;
    const difficulty = this.world.difficulty.getDifficulty(
      before.distance,
      this.world.difficultySnapshot,
    );
    this.player.update(deltaSeconds, difficulty.speed);
    this.world.update(deltaSeconds, this.player, before.distance);
    this.score.setPowerUpMultiplier(this.player.scoreMultiplierBonus);
    const scoring = this.score.update(deltaSeconds, this.player.currentSpeed);
    const snapshot = scoring.snapshot;

    this.missionDistancePending += scoring.distanceAdded;
    this.missionTimePending += deltaSeconds;
    this.missionAccumulator += deltaSeconds;
    if (this.missionAccumulator >= 0.25) {
      this.missions.record(MissionType.TravelDistance, this.missionDistancePending);
      this.missions.record(MissionType.SurviveSeconds, this.missionTimePending);
      this.missionDistancePending = 0;
      this.missionTimePending = 0;
      this.missionAccumulator = 0;
    }
    if (scoring.multiplierChanged) {
      this.missions.recordMaximum(MissionType.ReachMultiplier, snapshot.multiplier);
      this.ui.showToast(`Multiplier raised to x${snapshot.multiplier}`, 'success', 1_500);
    }

    const collision = this.world.checkCollisions(this.player);
    if (collision.coinsCollected > 0) {
      const points = this.score.collectCoins(collision.coinsCollected);
      this.missions.record(MissionType.CollectCoins, collision.coinsCollected);
      this.audio.play(SoundEffect.Coin);
      this.particles.emitCoinBurst(collision.lastCoinPosition);
      this.ui.showScorePopup(`+${Math.round(points)}`, this.player.position.x * 18);
    }
    if (collision.powerUpsCollected.length > 0) {
      for (const type of collision.powerUpsCollected) {
        this.particles.emitPowerUp(
          collision.lastPowerUpPosition,
          POWER_UP_DEFINITIONS[type].colour,
        );
        this.ui.showToast(`${POWER_UP_LABELS[type]} online`, 'success', 1_800);
      }
    }
    if (collision.jumpedObstacles > 0) {
      this.missions.record(MissionType.JumpObstacles, collision.jumpedObstacles);
    }
    if (collision.slidObstacles > 0) {
      this.missions.record(MissionType.SlideObstacles, collision.slidObstacles);
    }
    if (collision.hazardOutcome !== null && collision.hazardOutcome !== CollisionOutcome.Ignored) {
      const protectedHit = collision.hazardOutcome !== CollisionOutcome.Crashed;
      this.particles.emitImpact(collision.hazardPosition, protectedHit);
      this.cameraController.impact(protectedHit ? 0.7 : 1);
      if (collision.hazardOutcome === CollisionOutcome.Crashed) this.crashDelay = 0.72;
    }

    this.hudAccumulator += deltaSeconds;
    if (this.hudAccumulator >= 0.075) {
      this.ui.updateHUD(this.hudSnapshot(this.score.snapshot));
      this.updatePowerUpHUD();
      this.hudAccumulator = 0;
    }
    this.updateSpeedLines(deltaSeconds);
    this.updateMissionNotice(deltaSeconds);

    this.autosaveAccumulator += deltaSeconds;
    if (this.autosaveAccumulator >= 5) {
      this.persistProgress();
      this.autosaveAccumulator = 0;
    }
  }

  private readonly onPlayerEvent = (event: PlayerEvent): void => {
    switch (event.type) {
      case 'lane-change':
        this.telemetry.laneChanges += 1;
        this.missions.record(MissionType.ChangeLanes);
        this.audio.play(SoundEffect.LaneChange);
        break;
      case 'jump':
        this.telemetry.jumps += 1;
        this.audio.play(SoundEffect.Jump);
        break;
      case 'slide':
        this.telemetry.slides += 1;
        this.audio.play(SoundEffect.Slide);
        break;
      case 'power-up':
        this.telemetry.powerUps += 1;
        this.missions.record(MissionType.UsePowerUps);
        this.audio.play(SoundEffect.PowerUp);
        break;
      case 'shield-break':
        this.audio.play(SoundEffect.ShieldBreak);
        this.ui.showToast('Pulse Shield absorbed the impact', 'warning');
        break;
      case 'hover-break':
        this.telemetry.hoverBreaks += 1;
        this.missions.record(MissionType.BreakHoverDevice);
        this.audio.play(SoundEffect.HoverDeviceBreak);
        this.ui.showToast('Fluxboard shattered — keep moving!', 'warning');
        break;
      case 'collision':
        this.audio.play(SoundEffect.Collision);
        break;
      case 'crash':
        break;
    }
  };

  private updateSpeedLines(deltaSeconds: number): void {
    if (!this.saveData.settings.particleEffects || this.player.currentSpeed < 17) return;
    this.speedLineAccumulator += deltaSeconds;
    const interval = Math.max(0.025, 0.095 - this.player.currentSpeed * 0.0018);
    if (this.speedLineAccumulator < interval) return;
    this.speedLineAccumulator = 0;
    this.speedLinePosition.set(
      this.player.position.x + (Math.random() * 2 - 1) * 4.5,
      0.4 + Math.random() * 3.4,
      this.player.position.z - 3 - Math.random() * 5,
    );
    this.particles.emitSpeedLine(this.speedLinePosition);
  }

  private updatePowerUpHUD(): void {
    const indicators: PowerUpIndicator[] = [];
    for (const type of Object.values(PowerUpType)) {
      const remaining = this.player.getPowerUpRemaining(type);
      if (remaining <= 0) continue;
      const definition = POWER_UP_DEFINITIONS[type];
      indicators.push({
        id: type,
        label: POWER_UP_LABELS[type],
        remaining,
        duration: definition.duration,
        color: colourToCss(definition.colour),
      });
    }
    this.ui.updatePowerUps(indicators);
  }

  private updateMissionNotice(deltaSeconds: number): void {
    if (this.missionNoticeRemaining <= 0) return;
    this.missionNoticeRemaining = Math.max(0, this.missionNoticeRemaining - deltaSeconds);
    if (this.missionNoticeRemaining === 0) this.ui.showMissionProgress(null);
  }

  private startRun(): void {
    if (this.state.is(GameState.Paused) && !this.runFinalized) this.finalizeRun(false);
    if (!this.state.canTransition(GameState.Countdown)) return;

    this.runSequence += 1;
    this.telemetry = EMPTY_RUN_TELEMETRY();
    this.score.reset();
    this.player.reset(0);
    this.particles.clearParticles();
    const seed = this.fixedSeed ?? `skyline-${Date.now()}-${this.runSequence}`;
    this.world.reset(seed, 0);
    this.cameraController.reset(this.player);
    this.countdownRemaining = 3;
    this.countdownDisplay = '3';
    this.crashDelay = 0;
    this.runFinalized = false;
    this.hudAccumulator = 0;
    this.missionAccumulator = 0;
    this.missionDistancePending = 0;
    this.missionTimePending = 0;
    this.autosaveAccumulator = 0;
    this.speedLineAccumulator = 0;
    this.missionNoticeRemaining = 0;
    this.lastMissionNoticeId = '';
    this.ui.hud.reset();
    this.ui.setHoverDeviceInventory(this.saveData.hoverDeviceInventory);
    this.ui.setHoverDeviceActive(false);
    this.state.requireTransition(GameState.Countdown, 'new-run');
    this.ui.showCountdown(3, 'Get ready');
    void this.audio.unlock();
    this.audio.startMusic();
  }

  private pause(): void {
    if (!this.state.transition(GameState.Paused, 'player-pause')) return;
    const snapshot = this.score.snapshot;
    this.persistProgress();
    this.ui.showPause({ score: snapshot.score, distance: snapshot.distance });
    this.audio.play(SoundEffect.Button);
  }

  private resume(): void {
    if (this.contextLost) {
      this.ui.showToast('Waiting for the graphics context to recover', 'warning');
      return;
    }
    if (!this.state.transition(GameState.Running, 'player-resume')) return;
    this.ui.showHUD(this.hudSnapshot(this.score.snapshot));
    this.audio.play(SoundEffect.Button);
  }

  private restartRun(): void {
    this.audio.play(SoundEffect.Button);
    this.startRun();
  }

  private returnToMainMenu(): void {
    if (this.state.is(GameState.Paused) && !this.runFinalized) this.finalizeRun(false);
    if (!this.state.transition(GameState.MainMenu, 'return-to-menu')) return;
    this.player.reset(0);
    this.world.reset(this.fixedSeed ?? 'neon-drift-preview', 0);
    this.cameraController.reset(this.player);
    this.showMainMenu();
    this.audio.play(SoundEffect.Button);
  }

  private completeRun(crashed: boolean, showResults: boolean): void {
    const summary = this.finalizeRun(crashed);
    if (!showResults || summary === null) return;
    if (!this.state.transition(GameState.GameOver, crashed ? 'collision' : 'run-ended')) return;
    this.audio.play(SoundEffect.GameOver);
    this.ui.showGameOver(summary);
  }

  private finalizeRun(crashed: boolean): GameOverSummary | null {
    if (this.runFinalized) return null;
    this.runFinalized = true;
    if (this.missionDistancePending > 0) {
      this.missions.record(MissionType.TravelDistance, this.missionDistancePending);
      this.missionDistancePending = 0;
    }
    if (this.missionTimePending > 0) {
      this.missions.record(MissionType.SurviveSeconds, this.missionTimePending);
      this.missionTimePending = 0;
    }

    const score = this.score.snapshot;
    const previousHighScore = this.saveData.highScore;
    const missionSummary: MissionProgressSnapshot[] = this.missions.missions.map((mission) => ({
      id: mission.instanceId,
      label: mission.definition.title,
      progress: mission.progress,
      target: mission.target,
    }));
    const completedBeforeClaim = this.missions.missions.filter(
      (mission) => mission.completed,
    ).length;
    const missionRewards = this.missions.claimAllCompleted();
    const runExperience = this.progression.applyRun({
      score: score.score,
      distance: score.distance,
      coins: score.coins,
      completedMissions: completedBeforeClaim,
    });
    const missionExperience = this.progression.addExperience(missionRewards.experience);
    const experienceEarned = runExperience.experienceAdded + missionExperience.experienceAdded;
    const levelCoinRewards = runExperience.coinReward + missionExperience.coinReward;

    this.saveData = this.saves.recordRun({
      score: score.score,
      distance: score.distance,
      coins: score.coins,
      durationSeconds: score.elapsedSeconds,
      jumps: this.telemetry.jumps,
      slides: this.telemetry.slides,
      laneChanges: this.telemetry.laneChanges,
      powerUpsCollected: this.telemetry.powerUps,
      crashed,
    });
    const progression = this.progression.snapshot;
    this.saveData = this.saves.update((draft) => {
      draft.totalCoins += missionRewards.coins + levelCoinRewards;
      draft.playerLevel = progression.level;
      draft.experience = progression.experience;
      draft.activeMissions = this.missions.persistedMissions;
      draft.completedMissionCount = this.missions.completedMissionCount;
    });

    if (missionRewards.claimed.length > 0) {
      this.ui.showToast(
        `${missionRewards.claimed.length} mission${missionRewards.claimed.length === 1 ? '' : 's'} complete · +${missionRewards.coins} ◈`,
        'success',
        3_200,
      );
    }
    this.refreshMenuData();
    return {
      score: score.score,
      highScore: this.saveData.highScore,
      distance: score.distance,
      coins: score.coins,
      experienceEarned,
      multiplier: score.multiplier,
      isNewRecord: score.score > previousHighScore,
      missions: missionSummary,
    };
  }

  private activateHoverDevice(): void {
    if (!this.state.is(GameState.Running) || this.crashDelay > 0) return;
    if (this.saveData.hoverDeviceInventory <= 0) {
      this.ui.showToast('No Fluxboards available', 'warning');
      return;
    }
    if (!this.player.activateHoverDevice()) {
      this.ui.showToast('Fluxboard is already active', 'info', 1_500);
      return;
    }
    const result = this.economy.consumeHoverDevice();
    this.saveData = result.data;
    if (!result.ok) return;
    this.ui.setHoverDeviceInventory(this.saveData.hoverDeviceInventory);
    this.ui.setHoverDeviceActive(true);
    this.ui.showToast('Fluxboard deployed — one impact protected', 'success');
    this.audio.play(SoundEffect.PowerUp);
  }

  private resetSave(): void {
    this.runFinalized = true;
    this.crashDelay = 0;
    this.countdownRemaining = 0;
    this.score.reset();
    this.telemetry = EMPTY_RUN_TELEMETRY();
    if (this.state.is(GameState.Paused)) {
      this.state.transition(GameState.MainMenu, 'save-reset');
    }
    this.saveData = this.saves.reset();
    this.rebuildPersistentManagers();
    this.createPlayer();
    this.applySettings(this.toUISettings(this.saveData.settings), false);
    this.world.reset(this.fixedSeed ?? 'neon-drift-preview', 0);
    this.cameraController.reset(this.player);
    this.ui.showToast('Local progress reset', 'info');
    this.showMainMenu();
  }

  private createPlayer(): void {
    const definition =
      CHARACTER_DEFINITIONS.find((item) => item.id === this.saveData.equippedCharacter) ??
      CHARACTER_DEFINITIONS[0];
    if (definition === undefined) throw new Error('At least one runner must be configured.');

    const previous = this.player;
    const outfit = COSMETIC_DEFINITIONS.find(
      (item) => item.id === this.saveData.equippedCosmetics.outfit,
    );
    const colourVariation = COSMETIC_DEFINITIONS.find(
      (item) => item.id === this.saveData.equippedCosmetics.colour,
    );
    const hoverAppearance = COSMETIC_DEFINITIONS.find(
      (item) => item.id === this.saveData.equippedCosmetics.hoverDevice,
    );
    const next = new Player(
      {
        startingSpeed: GAME_CONFIG.player.startingSpeed,
        maximumSpeed: GAME_CONFIG.player.maximumSpeed,
        acceleration: GAME_CONFIG.player.acceleration,
        laneSpacing: GAME_CONFIG.player.laneSpacing,
        laneSwitchSpeed: GAME_CONFIG.player.laneSwitchSpeed,
        jumpHeight: GAME_CONFIG.player.jumpHeight,
        jumpDuration: GAME_CONFIG.player.jumpDuration,
        gravity: GAME_CONFIG.player.gravity,
        slideDuration: GAME_CONFIG.player.slideDuration,
        width: GAME_CONFIG.player.collider.width,
        height: GAME_CONFIG.player.collider.height,
        depth: GAME_CONFIG.player.collider.depth,
        slideHeight: GAME_CONFIG.player.collider.slideHeight,
      },
      {
        skin: definition.colours.skin,
        jacket: outfit?.colour ?? definition.colours.primary,
        accent: colourVariation?.colour ?? definition.colours.accent,
        trousers: definition.colours.secondary,
        shoes: colourVariation?.colour ?? definition.colours.accent,
      },
      this.onPlayerEvent,
    );
    if (hoverAppearance !== undefined) next.hoverDevice.setAppearance(hoverAppearance.colour);
    this.player = next;
    this.scene.add(next);
    if (previous !== undefined) this.disposePlayer(previous);
    if (this.cameraController !== undefined) this.cameraController.reset(next);
  }

  private disposePlayer(player: Player): void {
    player.removeFromParent();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    player.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      objectMaterials.forEach((material) => materials.add(material));
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }

  private rebuildPersistentManagers(): void {
    this.missions = new MissionManager({
      initialMissions: this.saveData.activeMissions,
      completedMissionCount: this.saveData.completedMissionCount,
      seed: `missions-${this.saveData.updatedAt}-${this.saveData.completedMissionCount}`,
    });
    this.progression = new ProgressionManager({
      level: this.saveData.playerLevel,
      experience: this.saveData.experience,
    });
    this.missions.onProgress(this.onMissionProgress);
    this.progression.onLevelUp((level) => {
      this.ui.showLevelUp(level);
      this.audio.play(SoundEffect.LevelUp);
    });
    this.persistProgress();
  }

  private readonly onMissionProgress = (update: MissionProgressUpdate): void => {
    const mission = this.missions.missions.find(
      (candidate) => candidate.instanceId === update.instanceId,
    );
    if (mission === undefined) return;
    const isNewNotice = this.lastMissionNoticeId !== update.instanceId;
    if (isNewNotice || update.completedNow || this.missionNoticeRemaining <= 0.2) {
      this.ui.showMissionProgress({
        id: update.instanceId,
        label: mission.definition.title,
        progress: update.progress,
        target: update.target,
      });
      this.lastMissionNoticeId = update.instanceId;
      this.missionNoticeRemaining = update.completedNow ? 3.2 : 1.8;
    }
    if (update.completedNow) {
      this.ui.showToast(`${mission.definition.title} complete`, 'success');
    }
  };

  private persistProgress(): void {
    if (this.missions === undefined) return;
    this.saveData = this.saves.update((draft) => {
      draft.activeMissions = this.missions.persistedMissions;
      draft.completedMissionCount = this.missions.completedMissionCount;
    });
  }

  private showMainMenu(): void {
    this.refreshMenuData();
    this.ui.setSettings(this.toUISettings(this.saveData.settings));
    this.ui.showMainMenu(this.menuData());
  }

  private refreshMenuData(): void {
    this.saveData = this.saves.data;
    this.ui.updateMenuData(this.menuData());
  }

  private menuData(): MainMenuData {
    const progress = this.progression.snapshot;
    const stats = this.saveData.statistics;
    const bestDistance =
      'longestDistance' in stats && typeof stats.longestDistance === 'number'
        ? stats.longestDistance
        : 0;
    const equippedCharacter = CHARACTER_DEFINITIONS.find(
      (item) => item.id === this.saveData.equippedCharacter,
    );
    return {
      profile: {
        name: playerTitle(progress.level),
        level: progress.level,
        experience: progress.experience,
        experienceForNextLevel: progress.experienceForNextLevel,
        totalCoins: this.saveData.totalCoins,
        highScore: this.saveData.highScore,
        bestDistance,
        hoverDevices: this.saveData.hoverDeviceInventory,
        equippedCharacterName: equippedCharacter?.name ?? 'Nova',
      },
      characters: CHARACTER_DEFINITIONS.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.tagline,
        accent: colourToCss(item.colours.primary),
        owned: this.saveData.ownedCharacters.includes(item.id),
        equipped: this.saveData.equippedCharacter === item.id,
        price: item.price,
      })),
      equipment: COSMETIC_DEFINITIONS.map((item) => ({
        id: item.id,
        name: item.name,
        kind: item.category.replace('-', ' '),
        accent: colourToCss(item.colour),
        owned: this.saveData.ownedCosmetics.includes(item.id),
        equipped:
          item.category === 'outfit'
            ? this.saveData.equippedCosmetics.outfit === item.id
            : item.category === 'colour'
              ? this.saveData.equippedCosmetics.colour === item.id
              : this.saveData.equippedCosmetics.hoverDevice === item.id,
        price: item.price,
      })),
      missions: this.missions.missions.map((mission) => ({
        id: mission.instanceId,
        title: mission.definition.title,
        description: mission.definition.description,
        progress: mission.progress,
        target: mission.target,
        reward: mission.coinReward,
        completed: mission.completed,
      })),
      statistics: {
        totalRuns: stats.totalRuns,
        totalDistance: stats.totalDistance,
        totalCoins: stats.totalCoinsCollected,
        highestScore: stats.highestScore,
        longestRun: stats.longestRun,
        totalJumps: stats.totalJumps,
        totalSlides: stats.totalSlides,
        totalLaneChanges: stats.totalLaneChanges,
        totalPowerUps: stats.totalPowerUpsCollected,
        totalCrashes: stats.totalCrashes,
      },
    };
  }

  private handleEconomyResult(result: EconomyResult, successMessage: string): void {
    this.saveData = result.data;
    if (result.ok) {
      this.audio.play(SoundEffect.Button);
      this.ui.showToast(successMessage, 'success');
    } else {
      const message =
        result.reason === 'insufficient-coins'
          ? 'Not enough Prism coins'
          : result.reason === 'already-owned'
            ? 'Already owned'
            : result.reason === 'not-owned'
              ? 'Unlock this item first'
              : 'That item is unavailable';
      this.ui.showToast(message, 'warning');
    }
    this.refreshMenuData();
  }

  private applySettings(settings: UISettings, persist: boolean): void {
    this.audio.setMusicVolume(settings.musicVolume);
    this.audio.setSoundEffectVolume(settings.sfxVolume);
    this.input.setSwipeThreshold(settings.swipeSensitivity);
    this.cameraController.setShakeEnabled(settings.cameraShake);
    this.particles.setEnabled(settings.particles);
    this.world.setGraphicsQuality(settings.graphicsQuality);
    this.renderer.shadowMap.enabled = settings.shadows && settings.graphicsQuality !== 'low';

    const pixelRatioLimit =
      settings.graphicsQuality === 'low' ? 1 : settings.graphicsQuality === 'medium' ? 1.5 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioLimit));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);

    if (persist) {
      this.saveData = this.saves.update((draft) => {
        draft.settings = {
          musicVolume: settings.musicVolume,
          soundEffectsVolume: settings.sfxVolume,
          swipeSensitivity: Math.max(0.25, Math.min(3, settings.swipeSensitivity / 45)),
          graphicsQuality: settings.graphicsQuality,
          cameraShake: settings.cameraShake,
          shadows: settings.shadows,
          particleEffects: settings.particles,
          language: settings.language,
        };
      });
    }
  }

  private toUISettings(settings: GameSettings): UISettings {
    return {
      musicVolume: settings.musicVolume,
      sfxVolume: settings.soundEffectsVolume,
      swipeSensitivity: this.swipePixels(settings),
      graphicsQuality: settings.graphicsQuality,
      cameraShake: settings.cameraShake,
      shadows: settings.shadows,
      particles: settings.particleEffects,
      language: settings.language,
    };
  }

  private swipePixels(settings: GameSettings): number {
    return Math.max(20, Math.min(100, Math.round(settings.swipeSensitivity * 45)));
  }

  private hudSnapshot(snapshot: ScoreSnapshot): HUDSnapshot {
    return {
      score: snapshot.score,
      coins: snapshot.coins,
      distance: snapshot.distance,
      multiplier: snapshot.multiplier,
      speed: snapshot.speed * 3.6,
      maxSpeed: GAME_CONFIG.player.maximumSpeed * 1.12 * 3.6,
      hoverDevices: this.saveData.hoverDeviceInventory,
      hoverDeviceActive: this.player.hasHoverDevice,
    };
  }

  private readonly resize = (): void => {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    this.renderer.setSize(width, height, false);
    this.cameraController.resize(width, height);
  };

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    this.input.setEnabled(false);
    if (this.state.is(GameState.Running)) this.pause();
    this.ui.showToast('Graphics paused while the renderer recovers.', 'warning', 5_000);
  };

  private readonly onContextRestored = (): void => {
    this.contextLost = false;
    this.input.setEnabled(true);
    this.renderer.resetState();
    this.resize();
    this.ui.showToast('Graphics restored', 'success', 1_800);
  };

  private nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
}
