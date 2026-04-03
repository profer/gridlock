import { Direction } from "../game/types";

type DirectionCallback = (direction: Direction) => void;
type TapCallback = () => void;

const SWIPE_THRESHOLD = 30;

export class InputHandler {
  private onDirection: DirectionCallback;
  private onTap: TapCallback;
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private touchStartTime: number = 0;

  constructor(onDirection: DirectionCallback, onTap: TapCallback) {
    this.onDirection = onDirection;
    this.onTap = onTap;
    this.bindEvents();
  }

  private bindEvents(): void {
    // Touch events
    window.addEventListener("touchstart", this.handleTouchStart.bind(this), { passive: false });
    window.addEventListener("touchend", this.handleTouchEnd.bind(this), { passive: false });

    // Keyboard events
    window.addEventListener("keydown", this.handleKeyDown.bind(this));

    // Prevent default touch behaviors
    window.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchStartTime = Date.now();
  }

  private handleTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const dx = touch.clientX - this.touchStartX;
    const dy = touch.clientY - this.touchStartY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const elapsed = Date.now() - this.touchStartTime;

    if (dist < SWIPE_THRESHOLD || elapsed > 500) {
      // It's a tap
      this.onTap();
      return;
    }

    // Determine swipe direction
    if (Math.abs(dx) > Math.abs(dy)) {
      this.onDirection(dx > 0 ? Direction.RIGHT : Direction.LEFT);
    } else {
      this.onDirection(dy > 0 ? Direction.DOWN : Direction.UP);
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        e.preventDefault();
        this.onDirection(Direction.UP);
        break;
      case "ArrowDown":
      case "s":
      case "S":
        e.preventDefault();
        this.onDirection(Direction.DOWN);
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        e.preventDefault();
        this.onDirection(Direction.LEFT);
        break;
      case "ArrowRight":
      case "d":
      case "D":
        e.preventDefault();
        this.onDirection(Direction.RIGHT);
        break;
      case " ":
      case "Enter":
        e.preventDefault();
        this.onTap();
        break;
    }
  }
}
