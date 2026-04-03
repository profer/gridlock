import { Game } from "./game/Game";
import { GameState, Direction } from "./game/types";
import { Renderer } from "./render/Renderer";
import { InputHandler } from "./input/InputHandler";
import { initAudio } from "./audio/SoundEngine";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const game = new Game();
const renderer = new Renderer(canvas);

function handleDirection(direction: Direction): void {
  if (game.state === GameState.PLAYING) {
    game.handleInput(direction);
  }
}

function handleTap(): void {
  initAudio(); // Unlock audio context on first user interaction

  if (game.state === GameState.MENU) {
    game.start();
  } else if (game.state === GameState.GAME_OVER && game.gameOverTimer > 1.0) {
    game.start();
  }
}

new InputHandler(handleDirection, handleTap);

// Also init audio on first swipe
let audioInitialized = false;
window.addEventListener("touchstart", () => {
  if (!audioInitialized) {
    initAudio();
    audioInitialized = true;
  }
}, { once: true });

// Handle resize
window.addEventListener("resize", () => renderer.resize());

// Game loop
let lastTime = 0;

function loop(timestamp: number): void {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.1); // cap at 100ms
  lastTime = timestamp;

  game.update(dt);
  renderer.render(game, dt);

  requestAnimationFrame(loop);
}

requestAnimationFrame((timestamp) => {
  lastTime = timestamp;
  requestAnimationFrame(loop);
});
