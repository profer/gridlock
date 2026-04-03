import { Grid } from "./Grid";
import { Direction, DIRECTION_DELTA, Position } from "./types";

const MAX_TRAIL = 6;

export class Player {
  pos: Position;
  visualX: number;
  visualY: number;
  trail: Position[];

  constructor(col: number, row: number) {
    this.pos = { col, row };
    this.visualX = col;
    this.visualY = row;
    this.trail = [];
  }

  reset(col: number, row: number): void {
    this.pos = { col, row };
    this.visualX = col;
    this.visualY = row;
    this.trail = [];
  }

  move(direction: Direction, grid: Grid, speed: boolean = false): { moved: boolean; intermediatePos: Position | null } {
    const delta = DIRECTION_DELTA[direction];
    const step1: Position = {
      col: this.pos.col + delta.col,
      row: this.pos.row + delta.row,
    };

    if (!grid.inBounds(step1) || !grid.isWalkable(step1)) {
      return { moved: false, intermediatePos: null };
    }

    this.trail.unshift({ ...this.pos });
    if (this.trail.length > MAX_TRAIL) {
      this.trail.pop();
    }

    if (speed) {
      // Try to move 2 cells
      const step2: Position = {
        col: step1.col + delta.col,
        row: step1.row + delta.row,
      };

      if (grid.inBounds(step2) && grid.isWalkable(step2)) {
        // Move 2 cells — skip over step1
        this.pos = step2;
        return { moved: true, intermediatePos: step1 };
      }
    }

    // Normal 1-cell move (or speed couldn't do 2)
    this.pos = step1;
    return { moved: true, intermediatePos: null };
  }

  hasValidMove(grid: Grid): boolean {
    for (const dir of Object.values(Direction)) {
      const delta = DIRECTION_DELTA[dir];
      const newPos: Position = {
        col: this.pos.col + delta.col,
        row: this.pos.row + delta.row,
      };
      if (grid.inBounds(newPos) && grid.isWalkable(newPos)) {
        return true;
      }
    }
    return false;
  }

  updateVisual(dt: number): void {
    const lerp = 1 - Math.pow(0.001, dt);
    this.visualX += (this.pos.col - this.visualX) * lerp;
    this.visualY += (this.pos.row - this.visualY) * lerp;
  }
}
