import { ObjectEffectType, type ScriptPlayer } from "zep-script";

import { isMissionStepComplete } from "../missionProgress";
import { debugMessage } from "../utils/message";
import { preparePlayerTag } from "../utils/player";

const MUYONGCHONG_MAP_NAMES = [
  "무용총",
  "고구려 무용총",
  "고구려무용총",
];
const MUYONGCHONG_MISSION_ID = "muyongchong";
const REQUIRED_STEP_IDS = [
  "archery-game",
  "arrow-order-game",
  "final-quiz",
];
const GATE_KEY_PREFIX = "muyongchong-completion-gate";
const GATE_Y = 17;
const GATE_MIN_X = 110;
const GATE_MAX_X = 113;
const BOUNCE_TARGET_X = 111;
const BOUNCE_TARGET_Y = 18;
const BLOCK_MESSAGE = "활쏘기 게임, 춤추기 게임, 퀴즈를 모두 완료해 주세요.";
const MESSAGE_COOLDOWN_MS = 1400;
const BOUNCE_COOLDOWN_MS = 500;
const WARNING_PADDING_X = 1;
const WARNING_SAFE_TILE_COUNT = 2;

const transparentGateSprite = ScriptApp.loadSpritesheet("images/transparent.png");

type MuyongchongGatePlayerTag = Record<string, unknown> & {
  muyongchongGateLastBounceAt?: number;
  muyongchongGateLastMessageAt?: number;
};

function isMuyongchongMap(mapName: string): boolean {
  const normalizedMapName = mapName.replace(/\s+/g, "");
  return (
    MUYONGCHONG_MAP_NAMES.includes(mapName) ||
    normalizedMapName.includes("무용총") ||
    normalizedMapName.toLowerCase().includes("muyongchong")
  );
}

function buildGateKey(x: number): string {
  return `${GATE_KEY_PREFIX}:${x}:${GATE_Y}`;
}

function parseGateKey(key: unknown): { x: number; y: number } | null {
  if (typeof key !== "string" || !key.startsWith(`${GATE_KEY_PREFIX}:`)) {
    return null;
  }

  const [, rawX, rawY] = key.split(":");
  const x = Number.parseInt(rawX ?? "", 10);
  const y = Number.parseInt(rawY ?? "", 10);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { x, y };
}

function areRequiredActivitiesComplete(player: ScriptPlayer): boolean {
  return REQUIRED_STEP_IDS.every(function (stepId) {
    return isMissionStepComplete(player, MUYONGCHONG_MISSION_ID, stepId);
  });
}

function showBlockedMessage(
  player: ScriptPlayer,
  options?: { force?: boolean }
): void {
  const tag = preparePlayerTag(player) as MuyongchongGatePlayerTag;
  const now = Date.now();
  const lastMessageAt = Number(tag.muyongchongGateLastMessageAt ?? 0);

  if (!options?.force && now - lastMessageAt < MESSAGE_COOLDOWN_MS) {
    return;
  }

  tag.muyongchongGateLastMessageAt = now;
  player.showCenterLabel(BLOCK_MESSAGE, 0xffffff, 0x000000, 420, 3000);
  player.sendUpdated();
}

function placeGateBlocks(player: ScriptPlayer): void {
  const playerPutIndividualObject = (player as any).putIndividualObject;
  if (typeof playerPutIndividualObject !== "function") {
    debugMessage({
      type: "muyongchong-gate:missing-putIndividualObject",
      playerId: player.id,
    });
    return;
  }

  for (let x = GATE_MIN_X; x <= GATE_MAX_X; x += 1) {
    playerPutIndividualObject.call(player, x, GATE_Y, transparentGateSprite, {
      type: ObjectEffectType.NONE,
      key: buildGateKey(x),
      overlap: true,
      impassable: true,
    });
  }
}

function removeGateBlocks(player: ScriptPlayer): void {
  const playerDisappearObject = (player as any).disappearObject;
  if (typeof playerDisappearObject !== "function") {
    debugMessage({
      type: "muyongchong-gate:missing-disappearObject",
      playerId: player.id,
    });
    return;
  }

  for (let x = GATE_MIN_X; x <= GATE_MAX_X; x += 1) {
    playerDisappearObject.call(player, buildGateKey(x));
  }
}

function getTileCoordinate(value: unknown): number {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? Math.floor(coordinate) : Number.NaN;
}

function isInsideBlockedGateZone(player: ScriptPlayer): boolean {
  const x = getTileCoordinate(player.tileX);
  const y = getTileCoordinate(player.tileY);
  return x >= GATE_MIN_X && x <= GATE_MAX_X && y <= GATE_Y;
}

function isInsideGateWarningZone(player: ScriptPlayer): boolean {
  const x = getTileCoordinate(player.tileX);
  const y = getTileCoordinate(player.tileY);
  return (
    x >= GATE_MIN_X - WARNING_PADDING_X &&
    x <= GATE_MAX_X + WARNING_PADDING_X &&
    y >= GATE_Y &&
    y <= GATE_Y + WARNING_SAFE_TILE_COUNT
  );
}

function bounceBack(player: ScriptPlayer): void {
  const tag = preparePlayerTag(player) as MuyongchongGatePlayerTag;
  const now = Date.now();
  const lastBounceAt = Number(tag.muyongchongGateLastBounceAt ?? 0);
  if (now - lastBounceAt < BOUNCE_COOLDOWN_MS) {
    return;
  }

  tag.muyongchongGateLastBounceAt = now;
  player.spawnAt(BOUNCE_TARGET_X, BOUNCE_TARGET_Y);
  player.sendUpdated();
}

export function syncMuyongchongGate(
  player: ScriptPlayer,
  mapName: string
): void {
  if (!isMuyongchongMap(mapName)) {
    return;
  }

  if (areRequiredActivitiesComplete(player)) {
    removeGateBlocks(player);
    return;
  }

  placeGateBlocks(player);
}

export function handleMuyongchongGateJoin(
  player: ScriptPlayer,
  mapName: string
): void {
  syncMuyongchongGate(player, mapName);
}

export function handleMuyongchongGateObjectKey(
  player: ScriptPlayer,
  key: unknown,
  mapName: string
): boolean {
  if (!isMuyongchongMap(mapName)) {
    return false;
  }

  const parsed = parseGateKey(key);
  if (!parsed) {
    return false;
  }

  if (areRequiredActivitiesComplete(player)) {
    removeGateBlocks(player);
    return true;
  }

  showBlockedMessage(player, { force: true });
  placeGateBlocks(player);
  bounceBack(player);
  return true;
}

export function registerMuyongchongGateTiles(): void {
  for (let x = GATE_MIN_X; x <= GATE_MAX_X; x += 1) {
    ScriptApp.addOnTileTouched(x, GATE_Y, function (player: ScriptPlayer) {
      if (!isMuyongchongMap(ScriptMap.name)) {
        return;
      }

      if (areRequiredActivitiesComplete(player)) {
        removeGateBlocks(player);
        return;
      }

      showBlockedMessage(player, { force: true });
      placeGateBlocks(player);
      bounceBack(player);
    });
  }
}

export function handleMuyongchongGateUpdate(mapName: string): void {
  if (!isMuyongchongMap(mapName)) {
    return;
  }

  ScriptApp.players.forEach(function (player) {
    if (areRequiredActivitiesComplete(player)) {
      removeGateBlocks(player);
      return;
    }

    if (isInsideBlockedGateZone(player)) {
      showBlockedMessage(player, { force: true });
      placeGateBlocks(player);
      bounceBack(player);
      return;
    }

    if (isInsideGateWarningZone(player)) {
      showBlockedMessage(player);
    }
  });
}
