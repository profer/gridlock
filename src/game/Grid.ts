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

  isWalkable(pos: Position): boolean {
    const cell = this.getCell(pos);
    return cell !== CellState.WALL;
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

  hasPowerUp(): boolean {
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const c = this.cells[row][col];
        if (c === CellState.POWERUP_BOMB || c === CellState.POWERUP_FREEZE || c === CellState.POWERUP_SPEED) {
          return true;
        }
      }
    }
    return false;
  }

  canReachAnyCollectible(from: Position): boolean {
    // Check if player can reach any pickup or power-up
    let hasCollectible = false;
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const c = this.cells[row][col];
        if (c === CellState.PICKUP || c === CellState.POWERUP_BOMB ||
            c === CellState.POWERUP_FREEZE || c === CellState.POWERUP_SPEED) {
          hasCollectible = true;
          break;
        }
      }
      if (hasCollectible) break;
    }
    if (!hasCollectible) return true; // nothing to collect, spawner will handle it

    const visited = Array.from({ length: GRID_SIZE }, () =>
      Array(GRID_SIZE).fill(false)
    );
    const queue: Position[] = [from];
    visited[from.row][from.col] = true;

    const dirs = [
      { col: 0, row: -1 },
      { col: 0, row: 1 },
      { col: -1, row: 0 },
      { col: 1, row: 0 },
    ];

    while (queue.length > 0) {
      const pos = queue.shift()!;

      for (const d of dirs) {
        const next: Position = { col: pos.col + d.col, row: pos.row + d.row };
        if (!this.inBounds(next)) continue;
        if (visited[next.row][next.col]) continue;
        if (this.cells[next.row][next.col] === CellState.WALL) continue;

        const cell = this.cells[next.row][next.col];
        if (cell === CellState.PICKUP || cell === CellState.POWERUP_BOMB ||
            cell === CellState.POWERUP_FREEZE || cell === CellState.POWERUP_SPEED) {
          return true;
        }

        visited[next.row][next.col] = true;
        queue.push(next);
      }
    }

    return false;
  }
}
