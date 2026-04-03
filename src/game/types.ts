export enum CellState {
  EMPTY = 0,
  WALL = 1,
  PICKUP = 2,
}

export enum Direction {
  UP = "up",
  DOWN = "down",
  LEFT = "left",
  RIGHT = "right",
}

export enum GameState {
  MENU = "menu",
  PLAYING = "playing",
  CRUSHING = "crushing",
  GAME_OVER = "game_over",
}

export interface Position {
  col: number;
  row: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export const GRID_SIZE = 8;

export const DIRECTION_DELTA: Record<Direction, Position> = {
  [Direction.UP]: { col: 0, row: -1 },
  [Direction.DOWN]: { col: 0, row: 1 },
  [Direction.LEFT]: { col: -1, row: 0 },
  [Direction.RIGHT]: { col: 1, row: 0 },
};

export const COLORS = {
  background: "#0a0a1a",
  gridBg: "#111128",
  gridLine: "#1a1a3e",
  player: "#00e5ff",
  playerGlow: "#00e5ff",
  playerTrail: "#0077b6",
  wall: "#e94560",
  wallGlow: "#ff6b6b",
  pickup: "#ffd166",
  pickupGlow: "#ffe49c",
  text: "#eef0f2",
  textDim: "#8892a0",
  combo: "#06d6a0",
};
