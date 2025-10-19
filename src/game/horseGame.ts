import { clamp } from "../utils";
import type {
  ActiveHorse,
  HorseLane,
  PlayerState,
  ScriptPlayer,
} from "./types";
import {
  CLEANUP_POLL_INTERVAL,
  DEFAULT_MOVE_SPEED,
  DEFAULT_HORSE_MOVE_SPEED,
  RETURN_DURATION,
  HORSE_LIFETIME,
  MAX_ACTIVE_HORSES,
  LEFT_TARGET_X_OVERRIDE,
  RIGHT_SPAWN_X_OVERRIDE,
  RIGHT_TARGET_X_OVERRIDE,
  SPAWN_JITTER_RATIO,
  HORSE_SPRITE_WIDTH,
  HORSE_SPRITE_HEIGHT,
} from "./constants";

const horseSprite = ScriptApp.loadSpritesheet(
  "images/horse.png",
  HORSE_SPRITE_WIDTH,
  HORSE_SPRITE_HEIGHT,
  { left: [0, 1, 2] },
  8
);

let horseLanes: HorseLane[] = [];
const laneTimers: Record<string, number> = {};
const activeHorses: ActiveHorse[] = [];
const activeHorseKeys = new Set<string>();
let cleanupAccumulator = 0;

function randomInt(min: number, max: number): number {
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  return lower + Math.floor(Math.random() * (upper - lower + 1));
}

function clearLaneTimers(): void {
  for (const key of Object.keys(laneTimers)) {
    delete laneTimers[key];
  }
}

function startHorseAnimation(key: string, lane: HorseLane): void {
  if (!activeHorseKeys.has(key)) {
    return;
  }

  try {
    const obj = ScriptMap.getObjectWithKey(key) as {
      tileX: number;
      tileY: number;
    } | null;
    if (!obj) {
      return;
    }

    ScriptMap.playObjectAnimationWithKey(key, "left", -1);
    if (obj.tileX !== lane.targetX) {
      ScriptMap.moveObjectWithKey(key, lane.targetX, obj.tileY, false);
    }
  } catch (err) {
    // In case the object disappears before we can animate it.
  }
}

function ensurePlayerState(player: ScriptPlayer): PlayerState {
  if (!player.tag) {
    player.tag = {};
  }

  const existing = player.tag.horseState as PlayerState | undefined;
  if (existing) {
    return existing;
  }

  const baseX = player.tileX;
  const baseY = player.tileY;
  const state: PlayerState = {
    targetX: baseX,
    isReturning: false,
    returnFromX: baseX,
    returnElapsed: 0,
    returnDuration: RETURN_DURATION,
    fixedY: baseY,
    lastSpawnX: baseX,
  };

  player.tag.horseState = state;
  return state;
}

function resetPlayers(): void {
  for (const player of ScriptApp.players as ScriptPlayer[]) {
    const state = ensurePlayerState(player);
    state.targetX = player.tileX;
    state.isReturning = false;
    state.returnElapsed = 0;
    state.returnFromX = player.tileX;
    state.lastSpawnX = player.tileX;
    state.fixedY = player.tileY;
    player.moveSpeed = DEFAULT_MOVE_SPEED;
    player.sprite = null;
    player.sendUpdated();
  }
}

function buildHorseLanes(): HorseLane[] {
  const width = Math.max(4, ScriptMap.width);

  const maxY = 30;
  const minY = 14;

  const spawnX =
    RIGHT_SPAWN_X_OVERRIDE !== null
      ? clamp(RIGHT_SPAWN_X_OVERRIDE, 0, width - 1)
      : clamp(width - 2, 0, width - 1);
  const targetX =
    RIGHT_TARGET_X_OVERRIDE !== null
      ? clamp(RIGHT_TARGET_X_OVERRIDE, 0, width - 1)
      : 0;

  return [
    {
      id: "east-stampede-fast",
      direction: "rightToLeft",
      spawnX,
      targetX,
      minY,
      maxY,
      interval: 1.5,
      speed: DEFAULT_HORSE_MOVE_SPEED,
    },
    {
      id: "east-stampede-slow",
      direction: "rightToLeft",
      spawnX,
      targetX,
      minY,
      maxY,
      interval: 3,
      speed: DEFAULT_HORSE_MOVE_SPEED,
    },
  ];
}

function resetHorseLanes(): void {
  horseLanes = buildHorseLanes();
  clearLaneTimers();
  activeHorses.length = 0;
  activeHorseKeys.clear();
  cleanupAccumulator = 0;
  ScriptMap.clearAllObjects();
}

function spawnHorse(lane: HorseLane): void {
  if (activeHorses.length >= MAX_ACTIVE_HORSES) {
    return;
  }

  const y = randomInt(lane.minY, lane.maxY);
  const key = `${lane.id}-${Date.now()}-${Math.floor(
    Math.random() * 100000
  )}-${Math.random().toString(36).slice(2, 6)}`;

  ScriptMap.putObjectWithKey(lane.spawnX, y, horseSprite, {
    key,
    overlap: true,
    movespeed: lane.speed,
    useDirAnim: false,
  });

  activeHorses.push({ key, lane, lifetime: 0 });
  activeHorseKeys.add(key);
  startHorseAnimation(key, lane);
}

function removeHorse(key: string): void {
  try {
    const obj = ScriptMap.getObjectWithKey(key) as any;
    if (obj) {
      ScriptMap.putObjectWithKey(obj.tileX, obj.tileY, null, { key });
    }
  } catch (err) {
    // object already removed
  }
  activeHorseKeys.delete(key);
}

function sendPlayerToLeftEdge(player: ScriptPlayer): void {
  const state = ensurePlayerState(player);
  if (state.isReturning) {
    return;
  }

  const width = Math.max(1, ScriptMap.width);
  const targetX =
    LEFT_TARGET_X_OVERRIDE !== null
      ? clamp(LEFT_TARGET_X_OVERRIDE, 0, width - 1)
      : 0;

  if (player.tileX === targetX) {
    return;
  }

  state.isReturning = true;
  state.returnElapsed = 0;
  state.returnFromX = player.tileX;
  state.targetX = targetX;
  state.fixedY = player.tileY;
  state.lastSpawnX = player.tileX;
  player.moveSpeed = 0;
  player.sendUpdated();
  player.showCenterLabel("말과 부딪혔어요! 왼쪽에서 다시 달려보세요.");
}

function updatePlayerReturns(dt: number): void {
  for (const player of ScriptApp.players as ScriptPlayer[]) {
    const state = ensurePlayerState(player);
    if (!state.isReturning) {
      continue;
    }

    state.returnElapsed += dt;
    const progress = clamp(state.returnElapsed / state.returnDuration, 0, 1);
    const interpolatedX = Math.round(
      state.returnFromX + (state.targetX - state.returnFromX) * progress
    );
    const width = Math.max(1, ScriptMap.width);
    const targetX = clamp(interpolatedX, 0, width - 1);

    if (targetX !== state.lastSpawnX) {
      player.spawnAt(targetX, state.fixedY);
      state.lastSpawnX = targetX;
    }

    if (progress >= 1) {
      state.isReturning = false;
      player.moveSpeed = DEFAULT_MOVE_SPEED;
      player.sendUpdated();
    }
  }
}

function updateHorseSpawning(dt: number): void {
  for (const lane of horseLanes) {
    const current = laneTimers[lane.id];
    const remaining =
      (typeof current === "number" ? current : lane.interval) - dt;
    if (remaining <= 0) {
      const before = activeHorses.length;
      spawnHorse(lane);
      const spawned = activeHorses.length > before;
      const base = lane.interval;
      const jitter = base * SPAWN_JITTER_RATIO;
      const next = base + (Math.random() * 2 - 1) * jitter;
      laneTimers[lane.id] = spawned ? Math.max(0.05, next) : 0.05;
    } else {
      laneTimers[lane.id] = remaining;
    }
  }
}

function updateHorseCleanup(dt: number): void {
  for (let i = activeHorses.length - 1; i >= 0; i--) {
    const horse = activeHorses[i];
    horse.lifetime += dt;

    if (horse.lifetime >= HORSE_LIFETIME) {
      removeHorse(horse.key);
      activeHorses.splice(i, 1);
      continue;
    }

    try {
      const obj = ScriptMap.getObjectWithKey(horse.key) as any;
      if (!obj) {
        removeHorse(horse.key);
        activeHorses.splice(i, 1);
        continue;
      }
      if (obj.tileX === horse.lane.targetX) {
        removeHorse(horse.key);
        activeHorses.splice(i, 1);
      }
    } catch (err) {
      removeHorse(horse.key);
      activeHorses.splice(i, 1);
    }
  }
}

export function startHorseGame(): void {
  resetHorseLanes();
  resetPlayers();
  for (const lane of horseLanes) {
    const initial = Math.random() * lane.interval;
    laneTimers[lane.id] = Math.max(0.05, initial);
  }
  if ((ScriptApp.players as ScriptPlayer[]).length > 0) {
    ScriptApp.showCenterLabel(
      "우측에서 달려오는 말을 피해 왼쪽에서 오른쪽으로 달려가세요!"
    );
  }
}

export function handlePlayerJoin(player: ScriptPlayer): void {
  const state = ensurePlayerState(player);
  state.targetX = player.tileX;
  state.returnFromX = player.tileX;
  state.returnElapsed = 0;
  state.isReturning = false;
  state.fixedY = player.tileY;
  state.lastSpawnX = player.tileX;
  player.moveSpeed = DEFAULT_MOVE_SPEED;
  player.sprite = null;
  player.sendUpdated();
  player.showCenterLabel("말을 피해서 오른쪽 끝까지 달려가세요.");

  if (activeHorseKeys.size === 0 && Object.keys(laneTimers).length === 0) {
    startHorseGame();
  }
}

export function handlePlayerLeave(player: ScriptPlayer): void {
  if (player.tag && player.tag.horseState) {
    delete player.tag.horseState;
  }

  if ((ScriptApp.players as ScriptPlayer[]).length === 0) {
    activeHorses.length = 0;
    activeHorseKeys.clear();
    clearLaneTimers();
    cleanupAccumulator = 0;
    ScriptMap.clearAllObjects();
  }
}

export function handleHorseTouched(player: ScriptPlayer, key: string): void {
  if (!activeHorseKeys.has(key)) {
    return;
  }
  sendPlayerToLeftEdge(player);
}

export function handleUpdate(dt: number): void {
  if (Object.keys(laneTimers).length === 0) {
    return;
  }
  updateHorseSpawning(dt);
  cleanupAccumulator += dt;
  if (cleanupAccumulator >= CLEANUP_POLL_INTERVAL) {
    updateHorseCleanup(cleanupAccumulator);
    cleanupAccumulator = 0;
  }
  updatePlayerReturns(dt);
}

export function handleDestroy(): void {
  activeHorses.length = 0;
  activeHorseKeys.clear();
  cleanupAccumulator = 0;
  clearLaneTimers();
  ScriptMap.clearAllObjects();
}
