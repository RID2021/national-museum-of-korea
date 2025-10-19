export type ScriptPlayer = any;

export type HorseDirection = "leftToRight" | "rightToLeft";

export interface HorseLane {
  id: string;
  direction: HorseDirection;
  spawnX: number;
  targetX: number;
  minY: number;
  maxY: number;
  interval: number;
  speed: number;
}

export interface ActiveHorse {
  key: string;
  lane: HorseLane;
  lifetime: number;
}

export interface PlayerState {
  targetX: number;
  isReturning: boolean;
  returnFromX: number;
  returnElapsed: number;
  returnDuration: number;
  fixedY: number;
  lastSpawnX: number;
}
