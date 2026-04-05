import { Game } from "./game/Game";
import { GameState, Direction } from "./game/types";
import { Renderer } from "./render/Renderer";
import { InputHandler } from "./input/InputHandler";
import { initAudio } from "./audio/SoundEngine";
import { startMenuMusic } from "./audio/MusicEngine";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const game = new Game();
const renderer = new Renderer(canvas);

let musicStarted = false;

function ensureMenuMusic(): void {
  if (musicStarted) return;
  initAudio();
  if (game.state === GameState.MENU) {
    startMenuMusic();
    musicStarted = true;
  }
}

// Attempt autoplay immediately
try {
  ensureMenuMusic();
} catch {
  // Blocked by autoplay policy
}

function onFirstInteraction(): void {
  ensureMenuMusic();
  window.removeEventListener("touchstart", onFirstInteraction);
  window.removeEventListener("mousedown", onFirstInteraction);
  window.removeEventListener("keydown", onFirstInteraction);
}
window.addEventListener("touchstart", onFirstInteraction, { once: true });
window.addEventListener("mousedown", onFirstInteraction, { once: true });
window.addEventListener("keydown", onFirstInteraction, { once: true });

function handleMove(direction: Direction, repeat: number): void {
  ensureMenuMusic();
  if (game.state === GameState.PLAYING) {
    for (let i = 0; i < repeat; i++) {
      game.handleInput(direction);
      // Stop if game ended during multi-move
      if (game.state !== GameState.PLAYING) break;
    }
  }
}

function handleTap(): void {
  ensureMenuMusic();

  if (game.state === GameState.MENU) {
    game.start();
  } else if (game.state === GameState.PLAYING) {
    // Tap during gameplay activates bomb on mobile
    game.useBomb();
  } else if (game.state === GameState.GAME_OVER && game.gameOverTimer > 1.0) {
    game.start();
  }
}

function handleBomb(): void {
  ensureMenuMusic();

  if (game.state === GameState.PLAYING) {
    game.useBomb();
  } else if (game.state === GameState.MENU) {
    game.start();
  } else if (game.state === GameState.GAME_OVER && game.gameOverTimer > 1.0) {
    game.start();
  }
}

const input = new InputHandler(handleMove, handleTap, handleBomb);

window.addEventListener("resize", () => renderer.resize());

let lastTime = 0;

function loop(timestamp: number): void {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;

  // Sync speed state to input handler for adaptive swipe/repeat
  input.speedActive = game.speedTimer > 0;

  game.update(dt);
  renderer.render(game, dt);

  requestAnimationFrame(loop);
}

requestAnimationFrame((timestamp) => {
  lastTime = timestamp;
  requestAnimationFrame(loop);
});
