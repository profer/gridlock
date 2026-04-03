import { CellState, GRID_SIZE, Position } from "./types";

export class Grid {
  cells: CellState[][];

  constructor() {
    this.cells = [];
    this.reset();
  }

  reset(): void {
    this.cells = Array.from({ length: GRID_SIZE }, () =>
      Array(GRID_SIZE).fill(CellState.EMPTY)
    );
  }

  getCell(pos: Position): CellState {
    if (!this.inBounds(pos)) return CellState.WALL;
    return this.cells[pos.row][pos.col];
  }

  setCell(pos: Position, state: CellState): void {
    if (this.inBounds(pos)) {
      this.cells[pos.row][pos.col] = state;
    }
  }

  inBounds(pos: Position): boolean {
    return pos.col >= 0 && pos.col < GRID_SIZE && pos.row >= 0 && pos.row < GRID_SIZE;
  }

  isEmpty(pos: Position): boolean {
    return this.getCell(pos) === CellState.EMPTY;
  }

  getEmptyCells(): Position[] {
    const empty: Position[] = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (this.cells[row][col] === CellState.EMPTY) {
          empty.push({ col, row });
        }
      }
    }
    return empty;
  }

  getWallCount(): number {
    let count = 0;
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (this.cells[row][col] === CellState.WALL) count++;
      }
    }
    return count;
  }

  getPickupCount(): number {
    let count = 0;
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (this.cells[row][col] === CellState.PICKUP) count++;
      }
    }
    return count;
  }
}
