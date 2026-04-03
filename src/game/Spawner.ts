import { Grid } from "./Grid";
import { CellState, GRID_SIZE, Position } from "./types";

export class Spawner {
  wallTimer: number;
  wallInterval: number;
  pickupTimer: number;
  pickupInterval: number;
  powerUpTimer: number;
  powerUpInterval: number;
  frozen: boolean;
  freezeTimer: number;

  constructor() {
    this.wallTimer = 0;
    this.wallInterval = 3.0;
    this.pickupTimer = 0;
    this.pickupInterval = 2.0;
    this.powerUpTimer = 0;
    this.powerUpInterval = 6.0;
    this.frozen = false;
    this.freezeTimer = 0;
  }

  reset(): void {
    this.wallTimer = 0;
    this.wallInterval = 3.0;
    this.pickupTimer = 0;
    this.pickupInterval = 2.0;
    this.powerUpTimer = 0;
    this.powerUpInterval = 6.0;
    this.frozen = false;
    this.freezeTimer = 0;
  }

  freeze(duration: number): void {
    this.frozen = true;
    this.freezeTimer = duration;
  }

  get isFrozen(): boolean {
    return this.frozen;
  }

  get freezeTimeLeft(): number {
    return this.freezeTimer;
  }

  update(dt: number, grid: Grid, playerPos: Position, score: number): { wallsSpawned: Position[]; pickupsSpawned: Position[]; powerUpSpawned: Position | null; powerUpType: CellState | null } {
    const wallsSpawned: Position[] = [];
    const pickupsSpawned: Position[] = [];
    let powerUpSpawned: Position | null = null;
    let powerUpType: CellState | null = null;

    // Freeze timer
    if (this.frozen) {
      this.freezeTimer -= dt;
      if (this.freezeTimer <= 0) {
        this.frozen = false;
        this.freezeTimer = 0;
      }
    }

    // Difficulty scaling
    this.wallInterval = Math.max(0.8, 3.0 - score * 0.03);
    this.pickupInterval = Math.max(1.0, 2.0 - score * 0.01);

    // Spawn walls (unless frozen)
    if (!this.frozen) {
      this.wallTimer += dt;
      if (this.wallTimer >= this.wallInterval) {
        this.wallTimer = 0;

        const wallCount = score > 30 ? 3 : score > 15 ? 2 : 1;
        for (let i = 0; i < wallCount; i++) {
          const pos = this.pickWallPosition(grid, playerPos);
          if (pos) {
            grid.setCell(pos, CellState.WALL);
            wallsSpawned.push(pos);
          }
        }
      }
    }

    // Spawn pickups
    this.pickupTimer += dt;
    if (this.pickupTimer >= this.pickupInterval && grid.getPickupCount() < 3) {
      this.pickupTimer = 0;
      const pos = this.pickEmptyCell(grid, playerPos);
      if (pos) {
        grid.setCell(pos, CellState.PICKUP);
        pickupsSpawned.push(pos);
      }
    }

    // Spawn power-ups (one at a time on the board)
    this.powerUpTimer += dt;
    if (this.powerUpTimer >= this.powerUpInterval && !grid.hasPowerUp()) {
      this.powerUpTimer = 0;
      const pos = this.pickEmptyCell(grid, playerPos);
      if (pos) {
        // Random power-up type, weighted
        const roll = Math.random();
        let type: CellState;
        if (roll < 0.35) {
          type = CellState.POWERUP_BOMB;
        } else if (roll < 0.65) {
          type = CellState.POWERUP_FREEZE;
        } else {
          type = CellState.POWERUP_SPEED;
        }
        grid.setCell(pos, type);
        powerUpSpawned = pos;
        powerUpType = type;
      }
    }

    return { wallsSpawned, pickupsSpawned, powerUpSpawned, powerUpType };
  }

  private pickWallPosition(grid: Grid, playerPos: Position): Position | null {
    const candidates: Position[] = [];
    const fallback: Position[] = [];

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (grid.cells[row][col] !== CellState.EMPTY) continue;
        if (col === playerPos.col && row === playerPos.row) continue;
        if (Math.abs(col - playerPos.col) + Math.abs(row - playerPos.row) <= 1) continue;

        const isEdge = row === 0 || row === GRID_SIZE - 1 || col === 0 || col === GRID_SIZE - 1;
        const adjacentToWall = this.hasAdjacentWall(grid, col, row);

        if (isEdge || adjacentToWall) {
          candidates.push({ col, row });
        } else {
          fallback.push({ col, row });
        }
      }
    }

    const pool = candidates.length > 0 ? candidates : fallback;
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private hasAdjacentWall(grid: Grid, col: number, row: number): boolean {
    const neighbors = [
      { col: col - 1, row },
      { col: col + 1, row },
      { col, row: row - 1 },
      { col, row: row + 1 },
    ];
    return neighbors.some((n) => grid.inBounds(n) && grid.getCell(n) === CellState.WALL);
  }

  private pickEmptyCell(grid: Grid, playerPos: Position): Position | null {
    const empty = grid.getEmptyCells().filter(
      (p) => !(p.col === playerPos.col && p.row === playerPos.row)
    );
    if (empty.length === 0) return null;
    return empty[Math.floor(Math.random() * empty.length)];
  }
}
