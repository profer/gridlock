import { Direction } from "../game/types";

type MoveCallback = (direction: Direction, repeat: number) => void;
type TapCallback = () => void;
type BombCallback = () => void;

const SWIPE_THRESHOLD = 30;
const SWIPE_CELL_SIZE = 70;       // pixels per cell (normal)
const SWIPE_CELL_SIZE_SPEED = 35; // pixels per cell (speed mode)

const REPEAT_DELAY = 180;
const REPEAT_INTERVAL = 90;
const REPEAT_INTERVAL_SPEED = 50; // faster repeat during speed

type DirectionKey = "up" | "down" | "left" | "right";

const KEY_TO_DIRECTION: Record<string, DirectionKey> = {
  ArrowUp: "up", w: "up", W: "up",
  ArrowDown: "down", s: "down", S: "down",
  ArrowLeft: "left", a: "left", A: "left",
  ArrowRight: "right", d: "right", D: "right",
};

const DIR_MAP: Record<DirectionKey, Direction> = {
  up: Direction.UP,
  down: Direction.DOWN,
  left: Direction.LEFT,
  right: Direction.RIGHT,
};

export class InputHandler {
  private onMove: MoveCallback;
  private onTap: TapCallback;
  private onBomb: BombCallback;
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private touchStartTime: number = 0;

  private heldDirection: DirectionKey | null = null;
  private heldKeys: Set<string> = new Set();
  private repeatTimer: number | null = null;
  private isRepeating: boolean = false;

  speedActive: boolean = false; // set externally by game loop

  constructor(onMove: MoveCallback, onTap: TapCallback, onBomb: BombCallback) {
    this.onMove = onMove;
    this.onTap = onTap;
    this.onBomb = onBomb;
    this.bindEvents();
  }

  private bindEvents(): void {
    window.addEventListener("touchstart", this.handleTouchStart.bind(this), { passive: false });
    window.addEventListener("touchend", this.handleTouchEnd.bind(this), { passive: false });
    window.addEventListener("keydown", this.handleKeyDown.bind(this));
    window.addEventListener("keyup", this.handleKeyUp.bind(this));
    window.addEventListener("blur", this.handleBlur.bind(this));
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
      this.onTap();
      return;
    }

    const cellSize = this.speedActive ? SWIPE_CELL_SIZE_SPEED : SWIPE_CELL_SIZE;
    const dominantDist = Math.max(Math.abs(dx), Math.abs(dy));
    const repeat = Math.min(4, Math.max(1, Math.round(dominantDist / cellSize)));

    if (Math.abs(dx) > Math.abs(dy)) {
      this.onMove(dx > 0 ? Direction.RIGHT : Direction.LEFT, repeat);
    } else {
      this.onMove(dy > 0 ? Direction.DOWN : Direction.UP, repeat);
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const dir = KEY_TO_DIRECTION[e.key];

    if (dir) {
      e.preventDefault();
      if (e.repeat) return;

      this.heldKeys.add(e.key);
      this.onMove(DIR_MAP[dir], 1);
      this.startRepeat(dir);
      return;
    }

    switch (e.key) {
      case " ":
      case "b":
      case "B":
        e.preventDefault();
        if (!e.repeat) {
          this.onBomb();
        }
        break;
      case "Enter":
        e.preventDefault();
        if (!e.repeat) {
          this.onTap();
        }
        break;
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.heldKeys.delete(e.key);

    const dir = KEY_TO_DIRECTION[e.key];
    if (dir && dir === this.heldDirection) {
      const stillHeld = this.findHeldDirection();
      if (stillHeld) {
        this.startRepeat(stillHeld);
      } else {
        this.stopRepeat();
      }
    }
  }

  private handleBlur(): void {
    this.heldKeys.clear();
    this.stopRepeat();
  }

  private findHeldDirection(): DirectionKey | null {
    for (const key of this.heldKeys) {
      const dir = KEY_TO_DIRECTION[key];
      if (dir) return dir;
    }
    return null;
  }

  private startRepeat(dir: DirectionKey): void {
    this.stopRepeat();
    this.heldDirection = dir;
    this.isRepeating = false;

    this.repeatTimer = window.setTimeout(() => {
      this.isRepeating = true;
      this.fireRepeat();
    }, REPEAT_DELAY);
  }

  private fireRepeat(): void {
    if (!this.heldDirection || !this.isRepeating) return;

    this.onMove(DIR_MAP[this.heldDirection], 1);

    const interval = this.speedActive ? REPEAT_INTERVAL_SPEED : REPEAT_INTERVAL;
    this.repeatTimer = window.setTimeout(() => {
      this.fireRepeat();
    }, interval);
  }

  private stopRepeat(): void {
    if (this.repeatTimer !== null) {
      clearTimeout(this.repeatTimer);
      this.repeatTimer = null;
    }
    this.heldDirection = null;
    this.isRepeating = false;
  }
}
