export interface PulseState {
  time: number;
}

export function pulse(time: number, speed: number = 2, min: number = 0.7, max: number = 1.0): number {
  const t = (Math.sin(time * speed) + 1) / 2;
  return min + t * (max - min);
}

export function breathe(time: number, speed: number = 1.5): number {
  return (Math.sin(time * speed) + 1) / 2;
}
