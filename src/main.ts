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

// Attempt autoplay immediately — will succeed if browser policy allows
try {
  ensureMenuMusic();
} catch {
  // Blocked by autoplay policy, will retry on first interaction
}

// Fallback: start on any user interaction
function onFirstInteraction(): void {
  ensureMenuMusic();
  window.removeEventListener("touchstart", onFirstInteraction);
  window.removeEventListener("mousedown", onFirstInteraction);
  window.removeEventListener("keydown", onFirstInteraction);
}
window.addEventListener("touchstart", onFirstInteraction, { once: true });
window.addEventListener("mousedown", onFirstInteraction, { once: true });
window.addEventListener("keydown", onFirstInteraction, { once: true });

function handleDirection(direction: Direction): void {
  ensureMenuMusic();
  if (game.state === GameState.PLAYING) {
    game.handleInput(direction);
  }
}

function handleTap(): void {
  ensureMenuMusic();

  if (game.state === GameState.MENU) {
    game.start();
  } else if (game.state === GameState.PLAYING) {
    game.useBomb();
  } else if (game.state === GameState.GAME_OVER && game.gameOverTimer > 1.0) {
    game.start();
  }
}

new InputHandler(handleDirection, handleTap);

window.addEventListener("resize", () => renderer.resize());

let lastTime = 0;

function loop(timestamp: number): void {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;

  game.update(dt);
  renderer.render(game, dt);

  requestAnimationFrame(loop);
}

requestAnimationFrame((timestamp) => {
  lastTime = timestamp;
  requestAnimationFrame(loop);
});
