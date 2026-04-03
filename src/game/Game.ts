import { Grid } from "./Grid";
import { Player } from "./Player";
import { Spawner } from "./Spawner";
import { CellState, Direction, GameState, GRID_SIZE, Particle, Position } from "./types";
import * as Sound from "../audio/SoundEngine";

const COMBO_WINDOW = 1.5; // seconds to keep combo alive
const CRUSH_DURATION = 1.8; // how long the crush animation takes

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
  wallAppearAnimations: Map<string, number>; // "col,row" -> animation progress 0-1
  gameOverTimer: number;
  totalTime: number;
  crushTimer: number;
  crushPhase: number; // 0-1 progress of crush animation
  playerCrushScale: number; // player shrinks during crush

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
    this.state = GameState.PLAYING;

    Sound.playGameStart();

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

    const moved = this.player.move(direction, this.grid);

    if (!moved) return;

    Sound.playMove();

    // Haptic: light tap on move
    this.vibrate(10);

    // Check if player landed on pickup
    const cell = this.grid.getCell(this.player.pos);
    if (cell === CellState.PICKUP) {
      this.collectPickup(this.player.pos);
    }

    // Check game over: no moves or no reachable pickups
    if (!this.player.hasValidMove(this.grid) || !this.grid.canReachAnyPickup(this.player.pos)) {
      this.triggerCrush();
    }
  }

  private collectPickup(pos: Position): void {
    this.grid.setCell(pos, CellState.EMPTY);

    // Combo logic
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

    // Sound
    Sound.playPickup(this.combo);
    if (this.combo >= 3) {
      Sound.playCombo(this.combo);
    }

    // Spawn particles
    this.spawnPickupParticles(pos);

    // Clear a wall on high combo
    if (this.combo >= 3) {
      this.clearRandomWall();
    }

    // Haptic: satisfying buzz, stronger for combos
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

    Sound.playCrush();

    // Heavy haptic
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

    // Final heavy haptic
    this.vibrate([80, 50, 120]);
  }

  update(dt: number): void {
    if (this.state === GameState.PLAYING) {
      this.totalTime += dt;

      // Combo timer decay
      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) {
          this.combo = 0;
        }
      }

      // Spawner
      const spawned = this.spawner.update(dt, this.grid, this.player.pos, this.score);

      // Animate new walls
      for (const pos of spawned.wallsSpawned) {
        this.wallAppearAnimations.set(`${pos.col},${pos.row}`, 0);
        Sound.playWallSpawn();
      }

      // Check game over after wall spawns: no moves or no reachable pickups
      if (!this.player.hasValidMove(this.grid) || !this.grid.canReachAnyPickup(this.player.pos)) {
        this.triggerCrush();
      }
    }

    if (this.state === GameState.CRUSHING) {
      this.crushTimer += dt;
      this.crushPhase = Math.min(1, this.crushTimer / CRUSH_DURATION);

      // Fill remaining empty cells with walls during crush
      if (this.crushPhase < 0.7) {
        const fillRate = dt * 8; // cells per second
        const cellsToFill = Math.random() < fillRate ? 1 : 0;
        for (let i = 0; i < cellsToFill; i++) {
          const empty = this.grid.getEmptyCells().filter(
            (p) => !(p.col === this.player.pos.col && p.row === this.player.pos.row)
          );
          if (empty.length > 0) {
            // Pick the cell closest to the player for dramatic effect
            empty.sort((a, b) => {
              const distA = Math.abs(a.col - this.player.pos.col) + Math.abs(a.row - this.player.pos.row);
              const distB = Math.abs(b.col - this.player.pos.col) + Math.abs(b.row - this.player.pos.row);
              return distB - distA; // farthest first, then close in
            });
            const idx = Math.min(Math.floor(Math.random() * 3), empty.length - 1);
            const pos = empty[idx];
            this.grid.setCell(pos, CellState.WALL);
            this.wallAppearAnimations.set(`${pos.col},${pos.row}`, 0);
          }
        }
      }

      // Player shrinks and shakes
      if (this.crushPhase > 0.5) {
        this.playerCrushScale = Math.max(0, 1 - (this.crushPhase - 0.5) * 2);
      }

      // Spawn crush particles around player
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

      // Haptic pulses during crush
      if (this.crushPhase > 0.3 && this.crushPhase < 0.9 && Math.random() < dt * 4) {
        this.vibrate(20);
      }

      // Transition to game over
      if (this.crushPhase >= 1) {
        // Fill the player cell too
        this.grid.setCell(this.player.pos, CellState.WALL);
        this.wallAppearAnimations.set(`${this.player.pos.col},${this.player.pos.row}`, 0);

        // Big burst of particles
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
    }

    // Update wall animations
    for (const [key, progress] of this.wallAppearAnimations) {
      if (progress < 1) {
        this.wallAppearAnimations.set(key, Math.min(1, progress + dt * 3));
      } else {
        this.wallAppearAnimations.delete(key);
      }
    }

    // Update particles
    this.updateParticles(dt);

    // Smooth player visual
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

  private spawnPickupParticles(pos: Position): void {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const speed = 2 + Math.random() * 3;
      this.particles.push({
        x: pos.col + 0.5,
        y: pos.row + 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        color: "#ffd166",
        size: 0.08 + Math.random() * 0.06,
      });
    }
  }

  private spawnWallClearParticles(pos: Position): void {
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      const speed = 1.5 + Math.random() * 2;
      this.particles.push({
        x: pos.col + 0.5,
        y: pos.row + 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.3 + Math.random() * 0.2,
        maxLife: 0.5,
        color: "#06d6a0",
        size: 0.1,
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
