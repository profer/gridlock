import { Grid } from "./Grid";
import { Player } from "./Player";
import { Spawner } from "./Spawner";
import { CellState, Direction, GameState, GRID_SIZE, Particle, Position } from "./types";

const COMBO_WINDOW = 1.5; // seconds to keep combo alive

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
    this.state = GameState.PLAYING;

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

    const prevPos = { ...this.player.pos };
    const moved = this.player.move(direction, this.grid);

    if (!moved) return;

    // Check if player landed on pickup
    const cell = this.grid.getCell(this.player.pos);
    if (cell === CellState.PICKUP) {
      this.collectPickup(this.player.pos);
    }

    // Check game over after move
    if (!this.player.hasValidMove(this.grid)) {
      this.triggerGameOver(prevPos);
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

    // Spawn particles
    this.spawnPickupParticles(pos);

    // Clear a wall on high combo
    if (this.combo >= 3) {
      this.clearRandomWall();
    }

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(this.combo >= 3 ? [30, 20, 30] : 15);
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
    }
  }

  private triggerGameOver(_prevPos: Position): void {
    this.state = GameState.GAME_OVER;
    this.gameOverTimer = 0;

    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveHighScore(this.score);
    }

    if (navigator.vibrate) {
      navigator.vibrate([50, 30, 80]);
    }
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
      }

      // Check game over after wall spawns
      if (!this.player.hasValidMove(this.grid)) {
        this.triggerGameOver(this.player.pos);
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
