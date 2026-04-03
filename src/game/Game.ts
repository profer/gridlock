import { Grid } from "./Grid";
import { Player } from "./Player";
import { Spawner } from "./Spawner";
import { CellState, Direction, GameState, GRID_SIZE, Particle, Position, Shockwave } from "./types";
import * as Sound from "../audio/SoundEngine";
import * as Music from "../audio/MusicEngine";

const COMBO_WINDOW = 1.5;
const CRUSH_DURATION = 1.8;
const FREEZE_DURATION = 5.0;
const SPEED_DURATION = 6.0;

export class Game {
  grid: Grid;
  player: Player;
  spawner: Spawner;
  state: GameState;
  score: number;
  highScore: number;
  combo: number;
  comboTimer: number;
  lastPickupTime: number;
  particles: Particle[];
  wallAppearAnimations: Map<string, number>;
  gameOverTimer: number;
  totalTime: number;
  crushTimer: number;
  crushPhase: number;
  playerCrushScale: number;

  // Power-ups
  hasBomb: boolean;
  speedTimer: number;
  bombFlashTimer: number;
  shockwaves: Shockwave[];
  screenShakeIntensity: number;

  constructor() {
    this.grid = new Grid();
    this.player = new Player(Math.floor(GRID_SIZE / 2), Math.floor(GRID_SIZE / 2));
    this.spawner = new Spawner();
    this.state = GameState.MENU;
    this.score = 0;
    this.highScore = this.loadHighScore();
    this.combo = 0;
    this.comboTimer = 0;
    this.lastPickupTime = 0;
    this.particles = [];
    this.wallAppearAnimations = new Map();
    this.gameOverTimer = 0;
    this.totalTime = 0;
    this.crushTimer = 0;
    this.crushPhase = 0;
    this.playerCrushScale = 1;
    this.hasBomb = false;
    this.speedTimer = 0;
    this.bombFlashTimer = 0;
    this.shockwaves = [];
    this.screenShakeIntensity = 0;
  }

  start(): void {
    this.grid.reset();
    this.player.reset(Math.floor(GRID_SIZE / 2), Math.floor(GRID_SIZE / 2));
    this.spawner.reset();
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.lastPickupTime = 0;
    this.particles = [];
    this.wallAppearAnimations.clear();
    this.gameOverTimer = 0;
    this.totalTime = 0;
    this.crushTimer = 0;
    this.crushPhase = 0;
    this.playerCrushScale = 1;
    this.hasBomb = false;
    this.speedTimer = 0;
    this.bombFlashTimer = 0;
    this.shockwaves = [];
    this.screenShakeIntensity = 0;
    this.state = GameState.PLAYING;

    Sound.playGameStart();
    Music.startGameplayMusic();

    // Spawn initial pickups
    for (let i = 0; i < 3; i++) {
      const empty = this.grid.getEmptyCells().filter(
        (p) => !(p.col === this.player.pos.col && p.row === this.player.pos.row)
      );
      if (empty.length > 0) {
        const pos = empty[Math.floor(Math.random() * empty.length)];
        this.grid.setCell(pos, CellState.PICKUP);
      }
    }
  }

  handleInput(direction: Direction): void {
    if (this.state !== GameState.PLAYING) return;

    const isSpeed = this.speedTimer > 0;
    const result = this.player.move(direction, this.grid, isSpeed);

    if (!result.moved) return;

    Sound.playMove();
    this.vibrate(isSpeed ? [8, 5, 8, 5, 8] : 10);

    // Process intermediate cells (speed mode passes through them)
    for (const pos of result.passedThrough) {
      const midCell = this.grid.getCell(pos);
      if (midCell === CellState.PICKUP) {
        this.collectPickup(pos);
      } else if (this.isPowerUp(midCell)) {
        this.collectPowerUp(pos, midCell);
      }
    }

    // Process walls smashed during speed move — dramatic break effect
    if (result.wallsSmashed.length > 0) {
      this.screenShakeIntensity = Math.min(10, result.wallsSmashed.length * 3);
      Sound.playSpeedSmash();
    }
    for (const pos of result.wallsSmashed) {
      this.spawnWallBreakParticles(pos);
      this.score += 5;
    }

    // Check landing cell
    const cell = this.grid.getCell(this.player.pos);
    if (cell === CellState.PICKUP) {
      this.collectPickup(this.player.pos);
    } else if (this.isPowerUp(cell)) {
      this.collectPowerUp(this.player.pos, cell);
    }

    // Check game over (speed can smash walls so use appropriate check)
    const hasMove = isSpeed ? this.player.hasValidMoveSpeed(this.grid) : this.player.hasValidMove(this.grid);
    if (!hasMove || !this.grid.canReachAnyCollectible(this.player.pos)) {
      if (!this.hasBomb) {
        this.triggerCrush();
      }
    }
  }

  useBomb(): void {
    if (this.state !== GameState.PLAYING || !this.hasBomb) return;

    this.hasBomb = false;
    Sound.playBombUse();
    this.vibrate([50, 30, 80, 40, 100, 30, 60]);

    // Massive screen shake
    this.screenShakeIntensity = 15;

    // Shockwave ring expanding from player
    this.shockwaves.push({
      x: this.player.pos.col + 0.5,
      y: this.player.pos.row + 0.5,
      radius: 0,
      maxRadius: GRID_SIZE * 1.5,
      speed: 12,
      life: 1.0,
      color: "#ff6b35",
    });

    // Second shockwave slightly delayed
    setTimeout(() => {
      this.shockwaves.push({
        x: this.player.pos.col + 0.5,
        y: this.player.pos.row + 0.5,
        radius: 0,
        maxRadius: GRID_SIZE * 1.2,
        speed: 8,
        life: 0.8,
        color: "#ff9f1c",
      });
    }, 150);

    // Clear ALL walls on the entire board
    let cleared = 0;
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const pos: Position = { col, row };
        if (this.grid.getCell(pos) === CellState.WALL) {
          this.grid.setCell(pos, CellState.EMPTY);
          // Stagger particle spawns by distance for ripple effect
          const dist = Math.abs(col - this.player.pos.col) + Math.abs(row - this.player.pos.row);
          setTimeout(() => this.spawnWallBreakParticles(pos), dist * 30);
          cleared++;
        }
      }
    }

    if (cleared > 0) {
      this.score += cleared * 5;
    }

    // Central explosion burst — lots of particles
    for (let i = 0; i < 30; i++) {
      const angle = (Math.PI * 2 * i) / 30;
      const speed = 3 + Math.random() * 7;
      this.particles.push({
        x: this.player.pos.col + 0.5,
        y: this.player.pos.row + 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6 + Math.random() * 0.5,
        maxLife: 1.1,
        color: ["#ff6b35", "#ff9f1c", "#ffffff", "#ffd166"][Math.floor(Math.random() * 4)],
        size: 0.1 + Math.random() * 0.15,
      });
    }

    // Inner bright flash particles
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      this.particles.push({
        x: this.player.pos.col + 0.5,
        y: this.player.pos.row + 0.5,
        vx: Math.cos(angle) * 1.5,
        vy: Math.sin(angle) * 1.5,
        life: 0.3,
        maxLife: 0.3,
        color: "#ffffff",
        size: 0.2,
      });
    }
  }

  private isPowerUp(cell: CellState): boolean {
    return cell === CellState.POWERUP_BOMB || cell === CellState.POWERUP_FREEZE || cell === CellState.POWERUP_SPEED;
  }

  private collectPowerUp(pos: Position, cell: CellState): void {
    this.grid.setCell(pos, CellState.EMPTY);

    switch (cell) {
      case CellState.POWERUP_BOMB:
        this.hasBomb = true;
        this.bombFlashTimer = 1.0;
        Sound.playBombCollect();
        this.vibrate([20, 15, 30]);
        this.spawnPowerUpParticles(pos, "#ff6b35");
        break;

      case CellState.POWERUP_FREEZE:
        this.spawner.freeze(FREEZE_DURATION);
        Sound.playFreezeCollect();
        this.vibrate([15, 10, 15, 10, 25]);
        this.spawnPowerUpParticles(pos, "#48bfe3");
        break;

      case CellState.POWERUP_SPEED:
        this.speedTimer = SPEED_DURATION;
        Sound.playSpeedCollect();
        this.vibrate([10, 5, 10, 5, 10, 5, 20]);
        this.spawnPowerUpParticles(pos, "#f72585");
        break;
    }

    this.score += 15;
  }

  private collectPickup(pos: Position): void {
    this.grid.setCell(pos, CellState.EMPTY);

    const now = this.totalTime;
    if (now - this.lastPickupTime < COMBO_WINDOW) {
      this.combo++;
    } else {
      this.combo = 1;
    }
    this.lastPickupTime = now;
    this.comboTimer = COMBO_WINDOW;

    const points = 10 * this.combo;
    this.score += points;

    Sound.playPickup(this.combo);
    if (this.combo >= 3) {
      Sound.playCombo(this.combo);
    }

    this.spawnPickupParticles(pos);

    if (this.combo >= 3) {
      this.clearRandomWall();
    }

    if (this.combo >= 3) {
      this.vibrate([20, 15, 20, 15, 30]);
    } else if (this.combo >= 2) {
      this.vibrate([15, 10, 20]);
    } else {
      this.vibrate(15);
    }
  }

  private clearRandomWall(): void {
    const walls: Position[] = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (this.grid.cells[row][col] === CellState.WALL) {
          walls.push({ col, row });
        }
      }
    }
    if (walls.length > 0) {
      const pos = walls[Math.floor(Math.random() * walls.length)];
      this.grid.setCell(pos, CellState.EMPTY);
      this.spawnWallClearParticles(pos);
      Sound.playWallClear();
    }
  }

  private triggerCrush(): void {
    this.state = GameState.CRUSHING;
    this.crushTimer = 0;
    this.crushPhase = 0;
    this.playerCrushScale = 1;

    Music.stopMusic();
    Sound.playCrush();
    this.vibrate([40, 30, 60, 40, 100]);
  }

  private finishGameOver(): void {
    this.state = GameState.GAME_OVER;
    this.gameOverTimer = 0;

    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveHighScore(this.score);
    }

    Sound.playGameOver();
    this.vibrate([80, 50, 120]);
  }

  update(dt: number): void {
    if (this.state === GameState.PLAYING) {
      this.totalTime += dt;

      // Update music intensity
      const totalCells = GRID_SIZE * GRID_SIZE;
      const wallCount = this.grid.getWallCount();
      const fillRatio = wallCount / totalCells;
      Music.setIntensity(fillRatio * 1.5);

      // Speed timer
      if (this.speedTimer > 0) {
        this.speedTimer -= dt;
        if (this.speedTimer <= 0) {
          this.speedTimer = 0;
          Sound.playSpeedEnd();
        }
      }

      // Bomb flash timer
      if (this.bombFlashTimer > 0) {
        this.bombFlashTimer -= dt;
      }

      // Freeze end sound
      if (this.spawner.isFrozen && this.spawner.freezeTimeLeft <= dt && this.spawner.freezeTimeLeft > 0) {
        Sound.playFreezeEnd();
      }

      // Combo timer decay
      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) {
          this.combo = 0;
        }
      }

      // Spawner
      const spawned = this.spawner.update(dt, this.grid, this.player.pos, this.score);

      for (const pos of spawned.wallsSpawned) {
        this.wallAppearAnimations.set(`${pos.col},${pos.row}`, 0);
        Sound.playWallSpawn();
      }

      if (spawned.powerUpSpawned) {
        Sound.playPowerUpSpawn();
      }

      // Check game over after wall spawns
      const canMove = this.speedTimer > 0 ? this.player.hasValidMoveSpeed(this.grid) : this.player.hasValidMove(this.grid);
      if (!canMove || !this.grid.canReachAnyCollectible(this.player.pos)) {
        if (!this.hasBomb) {
          this.triggerCrush();
        }
      }
    }

    if (this.state === GameState.CRUSHING) {
      this.crushTimer += dt;
      this.crushPhase = Math.min(1, this.crushTimer / CRUSH_DURATION);

      if (this.crushPhase < 0.7) {
        const fillRate = dt * 8;
        const cellsToFill = Math.random() < fillRate ? 1 : 0;
        for (let i = 0; i < cellsToFill; i++) {
          const empty = this.grid.getEmptyCells().filter(
            (p) => !(p.col === this.player.pos.col && p.row === this.player.pos.row)
          );
          if (empty.length > 0) {
            empty.sort((a, b) => {
              const distA = Math.abs(a.col - this.player.pos.col) + Math.abs(a.row - this.player.pos.row);
              const distB = Math.abs(b.col - this.player.pos.col) + Math.abs(b.row - this.player.pos.row);
              return distB - distA;
            });
            const idx = Math.min(Math.floor(Math.random() * 3), empty.length - 1);
            const pos = empty[idx];
            this.grid.setCell(pos, CellState.WALL);
            this.wallAppearAnimations.set(`${pos.col},${pos.row}`, 0);
          }
        }
      }

      if (this.crushPhase > 0.5) {
        this.playerCrushScale = Math.max(0, 1 - (this.crushPhase - 0.5) * 2);
      }

      if (this.crushPhase > 0.3 && Math.random() < dt * 10) {
        const angle = Math.random() * Math.PI * 2;
        this.particles.push({
          x: this.player.pos.col + 0.5 + Math.cos(angle) * 0.3,
          y: this.player.pos.row + 0.5 + Math.sin(angle) * 0.3,
          vx: Math.cos(angle) * (1 + Math.random() * 2),
          vy: Math.sin(angle) * (1 + Math.random() * 2),
          life: 0.3 + Math.random() * 0.3,
          maxLife: 0.6,
          color: "#00e5ff",
          size: 0.06 + Math.random() * 0.04,
        });
      }

      if (this.crushPhase > 0.3 && this.crushPhase < 0.9 && Math.random() < dt * 4) {
        this.vibrate(20);
      }

      if (this.crushPhase >= 1) {
        this.grid.setCell(this.player.pos, CellState.WALL);
        this.wallAppearAnimations.set(`${this.player.pos.col},${this.player.pos.row}`, 0);

        for (let i = 0; i < 16; i++) {
          const angle = (Math.PI * 2 * i) / 16;
          const speed = 3 + Math.random() * 4;
          this.particles.push({
            x: this.player.pos.col + 0.5,
            y: this.player.pos.row + 0.5,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.5 + Math.random() * 0.4,
            maxLife: 0.9,
            color: Math.random() > 0.5 ? "#00e5ff" : "#e94560",
            size: 0.08 + Math.random() * 0.08,
          });
        }

        this.finishGameOver();
      }
    }

    if (this.state === GameState.GAME_OVER) {
      this.gameOverTimer += dt;
      if (this.gameOverTimer > 3.0 && this.gameOverTimer - dt <= 3.0) {
        Music.startMenuMusic();
      }
    }

    // Update wall animations
    for (const [key, progress] of this.wallAppearAnimations) {
      if (progress < 1) {
        this.wallAppearAnimations.set(key, Math.min(1, progress + dt * 3));
      } else {
        this.wallAppearAnimations.delete(key);
      }
    }

    this.updateParticles(dt);
    this.updateShockwaves(dt);

    // Decay screen shake
    if (this.screenShakeIntensity > 0) {
      this.screenShakeIntensity *= Math.pow(0.02, dt); // fast decay
      if (this.screenShakeIntensity < 0.1) this.screenShakeIntensity = 0;
    }

    this.player.updateVisual(dt);
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private updateShockwaves(dt: number): void {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.radius += s.speed * dt;
      s.life -= dt;
      if (s.life <= 0 || s.radius > s.maxRadius) {
        this.shockwaves.splice(i, 1);
      }
    }
  }

  private spawnPickupParticles(pos: Position): void {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const speed = 2 + Math.random() * 3;
      this.particles.push({
        x: pos.col + 0.5, y: pos.row + 0.5,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.3, maxLife: 0.7,
        color: "#ffd166", size: 0.08 + Math.random() * 0.06,
      });
    }
  }

  private spawnPowerUpParticles(pos: Position, color: string): void {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const speed = 2.5 + Math.random() * 3;
      this.particles.push({
        x: pos.col + 0.5, y: pos.row + 0.5,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.3, maxLife: 0.8,
        color, size: 0.1 + Math.random() * 0.08,
      });
    }
  }

  private spawnWallClearParticles(pos: Position): void {
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      const speed = 1.5 + Math.random() * 2;
      this.particles.push({
        x: pos.col + 0.5, y: pos.row + 0.5,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0.3 + Math.random() * 0.2, maxLife: 0.5,
        color: "#06d6a0", size: 0.1,
      });
    }
  }

  private spawnWallBreakParticles(pos: Position): void {
    // Chunky debris particles — wall explodes into shards
    const colors = ["#e94560", "#ff6b6b", "#ff8888", "#cc3344"];
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      this.particles.push({
        x: pos.col + 0.2 + Math.random() * 0.6,
        y: pos.row + 0.2 + Math.random() * 0.6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 0.06 + Math.random() * 0.1,
      });
    }
  }

  private vibrate(pattern: number | number[]): void {
    try {
      navigator?.vibrate?.(pattern);
    } catch {
      // Vibration API not available
    }
  }

  private loadHighScore(): number {
    try {
      return parseInt(localStorage.getItem("gridlock_highscore") || "0", 10);
    } catch {
      return 0;
    }
  }

  private saveHighScore(score: number): void {
    try {
      localStorage.setItem("gridlock_highscore", String(score));
    } catch {
      // localStorage unavailable
    }
  }
}
