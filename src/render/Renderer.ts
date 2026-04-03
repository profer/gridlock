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
  private screenShakeX: number = 0;
  private screenShakeY: number = 0;
  private scorePopups: { value: number; x: number; y: number; timer: number }[] = [];
  private lastScore: number = 0;

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
    const availH = window.innerHeight - padding * 2 - 100; // more space for HUD
    this.cellSize = Math.floor(Math.min(availW, availH) / GRID_SIZE);
    const gridW = this.cellSize * GRID_SIZE;
    this.offsetX = Math.floor((window.innerWidth - gridW) / 2);
    this.offsetY = Math.floor((window.innerHeight - gridW) / 2) + 30;
  }

  render(game: Game, dt: number): void {
    this.time += dt;
    const ctx = this.ctx;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Track score popups
    if (game.score > this.lastScore && game.state === GameState.PLAYING) {
      const diff = game.score - this.lastScore;
      this.scorePopups.push({
        value: diff,
        x: this.offsetX + game.player.pos.col * this.cellSize + this.cellSize / 2,
        y: this.offsetY + game.player.pos.row * this.cellSize,
        timer: 0,
      });
    }
    this.lastScore = game.score;

    // Update score popups
    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      this.scorePopups[i].timer += dt;
      this.scorePopups[i].y -= dt * 40;
      if (this.scorePopups[i].timer > 0.8) {
        this.scorePopups.splice(i, 1);
      }
    }

    // Screen shake
    this.updateScreenShake(game, dt);

    // Clear
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, w, h);

    if (game.state === GameState.MENU) {
      this.renderMenu(w, h);
      return;
    }

    // Apply screen shake offset
    ctx.save();
    ctx.translate(this.screenShakeX, this.screenShakeY);

    this.renderGrid(game);
    this.renderWalls(game);
    this.renderPickups(game);

    if (game.state !== GameState.GAME_OVER || game.gameOverTimer < 0.1) {
      this.renderPlayer(game);
    }

    this.renderParticles(game);

    ctx.restore();

    // HUD renders without shake
    this.renderHUD(game, w);
    this.renderScorePopups(ctx);

    if (game.state === GameState.CRUSHING) {
      this.renderCrushOverlay(game, w, h);
    }

    if (game.state === GameState.GAME_OVER) {
      this.renderGameOver(game, w, h);
    }
  }

  private updateScreenShake(game: Game, _dt: number): void {
    if (game.state === GameState.CRUSHING) {
      const intensity = game.crushPhase * 6;
      this.screenShakeX = (Math.random() - 0.5) * intensity;
      this.screenShakeY = (Math.random() - 0.5) * intensity;
    } else if (game.state === GameState.GAME_OVER && game.gameOverTimer < 0.3) {
      const intensity = (1 - game.gameOverTimer / 0.3) * 8;
      this.screenShakeX = (Math.random() - 0.5) * intensity;
      this.screenShakeY = (Math.random() - 0.5) * intensity;
    } else {
      this.screenShakeX *= 0.8;
      this.screenShakeY *= 0.8;
      if (Math.abs(this.screenShakeX) < 0.1) this.screenShakeX = 0;
      if (Math.abs(this.screenShakeY) < 0.1) this.screenShakeY = 0;
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
    if (emptyCount < 15 && (game.state === GameState.PLAYING || game.state === GameState.CRUSHING)) {
      const intensity = (1 - emptyCount / 15) * pulse(this.time, 3, 0.3, 1.0);
      ctx.strokeStyle = `rgba(233, 69, 96, ${intensity * 0.8})`;
      ctx.lineWidth = 3 + intensity * 2;
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
    const scale = game.playerCrushScale;

    if (scale <= 0) return;

    // Trail
    for (let i = game.player.trail.length - 1; i >= 0; i--) {
      const t = game.player.trail[i];
      const alpha = (1 - i / game.player.trail.length) * 0.3;
      const cx = this.offsetX + t.col * cs + cs / 2;
      const cy = this.offsetY + t.row * cs + cs / 2;
      const radius = cs * 0.15 * (1 - i / game.player.trail.length);

      ctx.fillStyle = COLORS.playerTrail;
      ctx.globalAlpha = alpha * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Player dot
    const px = this.offsetX + game.player.visualX * cs + cs / 2;
    const py = this.offsetY + game.player.visualY * cs + cs / 2;
    const playerRadius = cs * 0.3 * scale;

    // Crush: player turns red as they're being crushed
    const crushTint = game.state === GameState.CRUSHING ? game.crushPhase : 0;

    // Outer glow
    const glowColor = crushTint > 0.3
      ? `rgba(233, 69, 96, ${0.8 * scale})`
      : COLORS.playerGlow;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 15 * pulse(this.time, crushTint > 0 ? 8 : 2, 0.6, 1.0) * scale;

    // Interpolate player color toward red during crush
    const r = Math.floor(0 + crushTint * 233);
    const g = Math.floor(229 - crushTint * 160);
    const b = Math.floor(255 - crushTint * 159);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;

    ctx.beginPath();
    ctx.arc(px, py, playerRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Inner bright core
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.6 * scale;
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
    const hudY = this.offsetY - 55;

    // Score background bar
    ctx.fillStyle = "rgba(17, 17, 40, 0.8)";
    const barX = this.offsetX - 8;
    const barW = this.cellSize * GRID_SIZE + 16;
    ctx.fillRect(barX, hudY - 4, barW, 42);

    // Score label
    ctx.fillStyle = COLORS.textDim;
    ctx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("SCORE", this.offsetX, hudY);

    // Score value
    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(`${game.score}`, this.offsetX, hudY + 14);

    // High score
    ctx.fillStyle = COLORS.textDim;
    ctx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("BEST", w - this.offsetX, hudY);
    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(`${game.highScore}`, w - this.offsetX, hudY + 14);

    // Combo indicator
    if (game.combo >= 2) {
      const comboAlpha = Math.min(1, game.comboTimer / 0.5);
      ctx.globalAlpha = comboAlpha;

      // Combo bar below grid
      const comboY = this.offsetY + GRID_SIZE * this.cellSize + 12;

      ctx.fillStyle = COLORS.combo;
      ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(`x${game.combo} COMBO`, w / 2, comboY);

      // Combo timer bar
      const timerWidth = (game.comboTimer / 1.5) * 100;
      ctx.fillStyle = COLORS.combo;
      ctx.globalAlpha = comboAlpha * 0.4;
      ctx.fillRect(w / 2 - 50, comboY + 28, timerWidth, 3);

      ctx.globalAlpha = 1;
    }
  }

  private renderScorePopups(ctx: CanvasRenderingContext2D): void {
    for (const popup of this.scorePopups) {
      const alpha = 1 - popup.timer / 0.8;
      const scale = 0.8 + popup.timer * 0.5;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.pickup;
      ctx.font = `bold ${Math.floor(16 * scale)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(`+${popup.value}`, popup.x, popup.y);
    }
    ctx.globalAlpha = 1;
  }

  private renderCrushOverlay(game: Game, w: number, h: number): void {
    const ctx = this.ctx;

    // Red vignette that intensifies
    const intensity = game.crushPhase;
    if (intensity > 0.2) {
      const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
      gradient.addColorStop(0, `rgba(233, 69, 96, 0)`);
      gradient.addColorStop(1, `rgba(233, 69, 96, ${(intensity - 0.2) * 0.4})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    }

    // "CRUSHING" flash text
    if (intensity > 0.3 && intensity < 0.8) {
      const textAlpha = Math.sin((intensity - 0.3) * 10) * 0.5 + 0.5;
      ctx.fillStyle = COLORS.wall;
      ctx.globalAlpha = textAlpha * 0.7;
      ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("CRUSHING...", w / 2, this.offsetY - 75);
      ctx.globalAlpha = 1;
    }
  }

  private renderGameOver(game: Game, w: number, h: number): void {
    const ctx = this.ctx;

    // Darken overlay
    const overlayAlpha = Math.min(0.75, game.gameOverTimer * 2);
    ctx.fillStyle = `rgba(10, 10, 26, ${overlayAlpha})`;
    ctx.fillRect(0, 0, w, h);

    if (game.gameOverTimer < 0.3) return;

    const fadeIn = Math.min(1, (game.gameOverTimer - 0.3) * 3);

    ctx.globalAlpha = fadeIn;

    // GRIDLOCKED text with glow
    ctx.shadowColor = COLORS.wallGlow;
    ctx.shadowBlur = 20;
    ctx.fillStyle = COLORS.wall;
    ctx.font = "bold 40px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("GRIDLOCKED!", w / 2, h / 2 - 50);
    ctx.shadowBlur = 0;

    // Score
    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 32px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(`${game.score}`, w / 2, h / 2 + 10);

    ctx.fillStyle = COLORS.textDim;
    ctx.font = "16px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("points", w / 2, h / 2 + 40);

    // New high score
    if (game.score === game.highScore && game.score > 0) {
      ctx.fillStyle = COLORS.combo;
      ctx.shadowColor = COLORS.combo;
      ctx.shadowBlur = 10;
      ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("NEW BEST!", w / 2, h / 2 + 70);
      ctx.shadowBlur = 0;
    }

    // Tap to restart
    if (game.gameOverTimer > 1.0) {
      const tapAlpha = 0.4 + breathe(this.time) * 0.6;
      ctx.fillStyle = COLORS.textDim;
      ctx.globalAlpha = fadeIn * tapAlpha;
      ctx.font = "20px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("Tap to Restart", w / 2, h / 2 + 120);
    }

    ctx.globalAlpha = 1;
  }

  getGridBounds(): { offsetX: number; offsetY: number; cellSize: number } {
    return { offsetX: this.offsetX, offsetY: this.offsetY, cellSize: this.cellSize };
  }
}
