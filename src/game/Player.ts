import { Grid } from "./Grid";
import { CellState, Direction, DIRECTION_DELTA, Position } from "./types";

const MAX_TRAIL = 6;

export interface MoveResult {
  moved: boolean;
  passedThrough: Position[]; // cells passed over (for collecting items)
  wallsSmashed: Position[]; // walls that were destroyed during speed move
}

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

  move(direction: Direction, grid: Grid, speed: boolean = false): MoveResult {
    const delta = DIRECTION_DELTA[direction];

    if (!speed) {
      // Normal move: 1 cell, must be walkable
      const next: Position = {
        col: this.pos.col + delta.col,
        row: this.pos.row + delta.row,
      };

      if (!grid.inBounds(next) || !grid.isWalkable(next)) {
        return { moved: false, passedThrough: [], wallsSmashed: [] };
      }

      this.trail.unshift({ ...this.pos });
      if (this.trail.length > MAX_TRAIL) this.trail.pop();

      this.pos = next;
      return { moved: true, passedThrough: [], wallsSmashed: [] };
    }

    // Speed mode: move 1 cell but smash through walls
    const next: Position = {
      col: this.pos.col + delta.col,
      row: this.pos.row + delta.row,
    };

    if (!grid.inBounds(next)) {
      return { moved: false, passedThrough: [], wallsSmashed: [] };
    }

    const wallsSmashed: Position[] = [];
    const cell = grid.getCell(next);

    if (cell === CellState.WALL) {
      grid.setCell(next, CellState.EMPTY);
      wallsSmashed.push(next);
    }

    this.trail.unshift({ ...this.pos });
    if (this.trail.length > MAX_TRAIL) this.trail.pop();

    this.pos = next;
    return { moved: true, passedThrough: [], wallsSmashed };
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

  hasValidMoveSpeed(grid: Grid): boolean {
    // With speed, any adjacent cell (even walls) counts if in bounds
    for (const dir of Object.values(Direction)) {
      const delta = DIRECTION_DELTA[dir];
      const newPos: Position = {
        col: this.pos.col + delta.col,
        row: this.pos.row + delta.row,
      };
      if (grid.inBounds(newPos)) {
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
