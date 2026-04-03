import { Grid } from "./Grid";
import { CellState, Direction, DIRECTION_DELTA, Position } from "./types";

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

  move(direction: Direction, grid: Grid): boolean {
    const delta = DIRECTION_DELTA[direction];
    const newPos: Position = {
      col: this.pos.col + delta.col,
      row: this.pos.row + delta.row,
    };

    if (!grid.inBounds(newPos)) return false;

    const cell = grid.getCell(newPos);
    if (cell === CellState.WALL) return false;

    this.trail.unshift({ ...this.pos });
    if (this.trail.length > MAX_TRAIL) {
      this.trail.pop();
    }

    this.pos = newPos;
    return true;
  }

  hasValidMove(grid: Grid): boolean {
    for (const dir of Object.values(Direction)) {
      const delta = DIRECTION_DELTA[dir];
      const newPos: Position = {
        col: this.pos.col + delta.col,
        row: this.pos.row + delta.row,
      };
      if (grid.inBounds(newPos) && grid.getCell(newPos) !== CellState.WALL) {
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
