import { Game } from "../game/Game";
import { CellState, COLORS, GRID_SIZE, GameState } from "../game/types";
import { easeOutCubic } from "../utils/math";
import { pulse, breathe } from "./animations";

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cellSize: number = 0;
  private offsetX: number = 0;
  private offsetY: number = 0;
  private time: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.resize();
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.scale(dpr, dpr);

    const padding = 24;
    const availW = window.innerWidth - padding * 2;
    const availH = window.innerHeight - padding * 2 - 80; // reserve space for UI
    this.cellSize = Math.floor(Math.min(availW, availH) / GRID_SIZE);
    const gridW = this.cellSize * GRID_SIZE;
    const gridH = this.cellSize * GRID_SIZE;
    this.offsetX = Math.floor((window.innerWidth - gridW) / 2);
    this.offsetY = Math.floor((window.innerHeight - gridH) / 2) + 20;
  }

  render(game: Game, dt: number): void {
    this.time += dt;
    const ctx = this.ctx;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Clear
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, w, h);

    if (game.state === GameState.MENU) {
      this.renderMenu(w, h);
      return;
    }

    this.renderGrid(game);
    this.renderWalls(game);
    this.renderPickups(game);
    this.renderPlayer(game);
    this.renderParticles(game);
    this.renderHUD(game, w);

    if (game.state === GameState.GAME_OVER) {
      this.renderGameOver(game, w, h);
    }
  }

  private renderMenu(w: number, h: number): void {
    const ctx = this.ctx;

    // Title
    ctx.fillStyle = COLORS.player;
    ctx.font = "bold 48px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("GRIDLOCK", w / 2, h / 2 - 60);

    // Subtitle
    ctx.fillStyle = COLORS.textDim;
    ctx.font = "18px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("Navigate the shrinking grid", w / 2, h / 2 - 10);

    // Tap to play with breathing animation
    const alpha = 0.4 + breathe(this.time) * 0.6;
    ctx.fillStyle = `rgba(238, 240, 242, ${alpha})`;
    ctx.font = "22px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("Tap to Play", w / 2, h / 2 + 60);

    // Instructions
    ctx.fillStyle = COLORS.textDim;
    ctx.font = "14px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("Swipe or use arrow keys to move", w / 2, h / 2 + 110);
    ctx.fillText("Collect pickups. Avoid gridlock.", w / 2, h / 2 + 135);
  }

  private renderGrid(game: Game): void {
    const ctx = this.ctx;
    const cs = this.cellSize;

    // Grid background
    ctx.fillStyle = COLORS.gridBg;
    ctx.fillRect(this.offsetX, this.offsetY, cs * GRID_SIZE, cs * GRID_SIZE);

    // Grid lines
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(this.offsetX + i * cs, this.offsetY);
      ctx.lineTo(this.offsetX + i * cs, this.offsetY + GRID_SIZE * cs);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(this.offsetX, this.offsetY + i * cs);
      ctx.lineTo(this.offsetX + GRID_SIZE * cs, this.offsetY + i * cs);
      ctx.stroke();
    }

    // Danger indicator: border glow when few cells remain
    const emptyCount = game.grid.getEmptyCells().length;
    if (emptyCount < 15 && game.state === GameState.PLAYING) {
      const intensity = (1 - emptyCount / 15) * pulse(this.time, 3, 0.3, 1.0);
      ctx.strokeStyle = `rgba(233, 69, 96, ${intensity * 0.6})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(this.offsetX - 2, this.offsetY - 2, cs * GRID_SIZE + 4, cs * GRID_SIZE + 4);
    }
  }

  private renderWalls(game: Game): void {
    const ctx = this.ctx;
    const cs = this.cellSize;
    const pad = 1;

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (game.grid.cells[row][col] !== CellState.WALL) continue;

        const key = `${col},${row}`;
        const animProgress = game.wallAppearAnimations.get(key);
        let scale = 1;
        if (animProgress !== undefined) {
          scale = easeOutCubic(animProgress);
        }

        const x = this.offsetX + col * cs + pad;
        const y = this.offsetY + row * cs + pad;
        const size = cs - pad * 2;

        const centerX = x + size / 2;
        const centerY = y + size / 2;
        const drawSize = size * scale;

        ctx.fillStyle = COLORS.wall;
        ctx.globalAlpha = 0.7 + scale * 0.3;
        ctx.fillRect(
          centerX - drawSize / 2,
          centerY - drawSize / 2,
          drawSize,
          drawSize
        );

        // Subtle glow for new walls
        if (animProgress !== undefined && animProgress < 1) {
          ctx.shadowColor = COLORS.wallGlow;
          ctx.shadowBlur = 10 * (1 - animProgress);
          ctx.fillRect(
            centerX - drawSize / 2,
            centerY - drawSize / 2,
            drawSize,
            drawSize
          );
          ctx.shadowBlur = 0;
        }

        ctx.globalAlpha = 1;
      }
    }
  }

  private renderPickups(game: Game): void {
    const ctx = this.ctx;
    const cs = this.cellSize;

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (game.grid.cells[row][col] !== CellState.PICKUP) continue;

        const cx = this.offsetX + col * cs + cs / 2;
        const cy = this.offsetY + row * cs + cs / 2;
        const radius = cs * 0.2 * pulse(this.time + col + row, 2.5, 0.8, 1.0);

        // Glow
        ctx.shadowColor = COLORS.pickupGlow;
        ctx.shadowBlur = 12;

        ctx.fillStyle = COLORS.pickup;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
      }
    }
  }

  private renderPlayer(game: Game): void {
    const ctx = this.ctx;
    const cs = this.cellSize;

    // Trail
    for (let i = game.player.trail.length - 1; i >= 0; i--) {
      const t = game.player.trail[i];
      const alpha = (1 - i / game.player.trail.length) * 0.3;
      const cx = this.offsetX + t.col * cs + cs / 2;
      const cy = this.offsetY + t.row * cs + cs / 2;
      const radius = cs * 0.15 * (1 - i / game.player.trail.length);

      ctx.fillStyle = COLORS.playerTrail;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Player dot
    const px = this.offsetX + game.player.visualX * cs + cs / 2;
    const py = this.offsetY + game.player.visualY * cs + cs / 2;
    const playerRadius = cs * 0.3;

    // Outer glow
    ctx.shadowColor = COLORS.playerGlow;
    ctx.shadowBlur = 15 * pulse(this.time, 2, 0.6, 1.0);

    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(px, py, playerRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Inner bright core
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(px, py, playerRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private renderParticles(game: Game): void {
    const ctx = this.ctx;
    const cs = this.cellSize;

    for (const p of game.particles) {
      const alpha = p.life / p.maxLife;
      const x = this.offsetX + p.x * cs;
      const y = this.offsetY + p.y * cs;
      const size = p.size * cs * alpha;

      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private renderHUD(game: Game, w: number): void {
    const ctx = this.ctx;

    // Score
    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${game.score}`, this.offsetX, this.offsetY - 45);

    // High score
    ctx.fillStyle = COLORS.textDim;
    ctx.font = "14px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`Best: ${game.highScore}`, w - this.offsetX, this.offsetY - 40);

    // Combo
    if (game.combo >= 2) {
      const comboAlpha = Math.min(1, game.comboTimer / 0.5);
      ctx.fillStyle = COLORS.combo;
      ctx.globalAlpha = comboAlpha;
      ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        `x${game.combo} COMBO`,
        w / 2,
        this.offsetY + GRID_SIZE * this.cellSize + 20
      );
      ctx.globalAlpha = 1;
    }
  }

  private renderGameOver(game: Game, w: number, h: number): void {
    const ctx = this.ctx;

    // Darken overlay
    const overlayAlpha = Math.min(0.7, game.gameOverTimer * 2);
    ctx.fillStyle = `rgba(10, 10, 26, ${overlayAlpha})`;
    ctx.fillRect(0, 0, w, h);

    if (game.gameOverTimer < 0.3) return;

    const fadeIn = Math.min(1, (game.gameOverTimer - 0.3) * 3);

    ctx.globalAlpha = fadeIn;

    // GRIDLOCKED text
    ctx.fillStyle = COLORS.wall;
    ctx.font = "bold 40px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("GRIDLOCKED!", w / 2, h / 2 - 50);

    // Score
    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 32px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(`Score: ${game.score}`, w / 2, h / 2 + 10);

    // New high score
    if (game.score === game.highScore && game.score > 0) {
      ctx.fillStyle = COLORS.combo;
      ctx.font = "18px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("New Best!", w / 2, h / 2 + 50);
    }

    // Tap to restart
    if (game.gameOverTimer > 1.0) {
      const tapAlpha = 0.4 + breathe(this.time) * 0.6;
      ctx.fillStyle = COLORS.textDim;
      ctx.globalAlpha = fadeIn * tapAlpha;
      ctx.font = "20px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("Tap to Restart", w / 2, h / 2 + 100);
    }

    ctx.globalAlpha = 1;
  }

  getGridBounds(): { offsetX: number; offsetY: number; cellSize: number } {
    return { offsetX: this.offsetX, offsetY: this.offsetY, cellSize: this.cellSize };
  }
}
