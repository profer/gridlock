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

function ensureMusic(): void {
  initAudio();
  if (!musicStarted) {
    musicStarted = true;
    if (game.state === GameState.MENU) {
      startMenuMusic();
    }
  }
}

function handleDirection(direction: Direction): void {
  ensureMusic();
  if (game.state === GameState.PLAYING) {
    game.handleInput(direction);
  }
}

function handleTap(): void {
  ensureMusic();

  if (game.state === GameState.MENU) {
    game.start();
  } else if (game.state === GameState.PLAYING) {
    // Tap during gameplay activates bomb if available
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
