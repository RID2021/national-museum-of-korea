import { ObjectEffectType, type ScriptPlayer } from "zep-script";

import { isMissionStepComplete } from "../missionProgress";
import { debugMessage } from "../utils/message";
import { preparePlayerTag } from "../utils/player";

const MURYEONG_MAP_NAMES = [
  "무령왕릉",
  "백제 무령왕릉",
  "백제무령왕릉",
];
const MURYEONG_MISSION_ID = "muryeong-tomb";
const REQUIRED_STEP_IDS = [
  "bronze-mirror",
  "pine-coffin",
  "ebony-pillow",
  "exchange-region-game",
  "final-quiz",
];
const GATE_KEY_PREFIX = "muryeong-completion-gate";
const GATE_Y = 37;
const GATE_MIN_X = 48;
const GATE_MAX_X = 50;
const BOUNCE_TARGET_X = 49;
const BOUNCE_TARGET_Y = 38;
const GUIDE_GATE_KEY_PREFIX = "muryeong-burial-guide-gate";
const GUIDE_GATE_Y = 64;
const GUIDE_GATE_MIN_X = 48;
const GUIDE_GATE_MAX_X = 50;
const GUIDE_GATE_BOUNCE_TARGET_X = 49;
const GUIDE_GATE_BOUNCE_TARGET_Y = 65;
const GUIDE_GATE_REQUIRED_STEP_ID = "burial-goods-guide";
const BLOCK_MESSAGE = "미션을 모두 수행하고 이동하세요.";
const GUIDE_GATE_BLOCK_MESSAGE = "진묘수의 안내를 먼저 확인하고 이동하세요.";
const MESSAGE_COOLDOWN_MS = 1400;
const BOUNCE_COOLDOWN_MS = 500;
const WARNING_PADDING_X = 1;
const WARNING_SAFE_TILE_COUNT = 2;

const transparentGateSprite = ScriptApp.loadSpritesheet("images/transparent.png");

type MuryeongGatePlayerTag = Record<string, unknown> & {
  muryeongGateLastBounceAt?: number;
  muryeongGateLastMessageAt?: number;
};

type MuryeongGateType = "completion" | "guide";

function isMuryeongMap(mapName: string): boolean {
  const normalizedMapName = mapName.replace(/\s+/g, "");
  return (
    MURYEONG_MAP_NAMES.includes(mapName) ||
    normalizedMapName.includes("무령왕릉") ||
    normalizedMapName.toLowerCase().includes("muryeong")
  );
}

function buildGateKey(x: number): string {
  return `${GATE_KEY_PREFIX}:${x}:${GATE_Y}`;
}

function buildGuideGateKey(x: number): string {
  return `${GUIDE_GATE_KEY_PREFIX}:${x}:${GUIDE_GATE_Y}`;
}

function parseGateKey(
  key: unknown
): { gateType: MuryeongGateType; x: number; y: number } | null {
  if (typeof key !== "string") {
    return null;
  }

  const gateType = key.startsWith(`${GATE_KEY_PREFIX}:`)
    ? "completion"
    : key.startsWith(`${GUIDE_GATE_KEY_PREFIX}:`)
      ? "guide"
      : null;
  if (!gateType) {
    return null;
  }

  const [, rawX, rawY] = key.split(":");
  const x = Number.parseInt(rawX ?? "", 10);
  const y = Number.parseInt(rawY ?? "", 10);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { gateType, x, y };
}

function areRequiredActivitiesComplete(player: ScriptPlayer): boolean {
  return REQUIRED_STEP_IDS.every(function (stepId) {
    return isMissionStepComplete(player, MURYEONG_MISSION_ID, stepId);
  });
}

function isBurialGoodsGuideComplete(player: ScriptPlayer): boolean {
  return isMissionStepComplete(
    player,
    MURYEONG_MISSION_ID,
    GUIDE_GATE_REQUIRED_STEP_ID
  );
}

function showBlockedMessage(
  player: ScriptPlayer,
  options?: { force?: boolean; message?: string }
): void {
  const tag = preparePlayerTag(player) as MuryeongGatePlayerTag;
  const now = Date.now();
  const lastMessageAt = Number(tag.muryeongGateLastMessageAt ?? 0);

  if (!options?.force && now - lastMessageAt < MESSAGE_COOLDOWN_MS) {
    return;
  }

  tag.muryeongGateLastMessageAt = now;
  player.showCenterLabel(
    options?.message ?? BLOCK_MESSAGE,
    0xffffff,
    0x000000,
    420,
    3000
  );
  player.sendUpdated();
}

function placeGateBlocks(player: ScriptPlayer): void {
  const playerPutIndividualObject = (player as any).putIndividualObject;
  if (typeof playerPutIndividualObject !== "function") {
    debugMessage({
      type: "muryeong-gate:missing-putIndividualObject",
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
      type: "muryeong-gate:missing-disappearObject",
      playerId: player.id,
    });
    return;
  }

  for (let x = GATE_MIN_X; x <= GATE_MAX_X; x += 1) {
    playerDisappearObject.call(player, buildGateKey(x));
  }
}

function placeGuideGateBlocks(player: ScriptPlayer): void {
  const playerPutIndividualObject = (player as any).putIndividualObject;
  if (typeof playerPutIndividualObject !== "function") {
    debugMessage({
      type: "muryeong-guide-gate:missing-putIndividualObject",
      playerId: player.id,
    });
    return;
  }

  for (let x = GUIDE_GATE_MIN_X; x <= GUIDE_GATE_MAX_X; x += 1) {
    playerPutIndividualObject.call(
      player,
      x,
      GUIDE_GATE_Y,
      transparentGateSprite,
      {
        type: ObjectEffectType.NONE,
        key: buildGuideGateKey(x),
        overlap: true,
        impassable: true,
      }
    );
  }
}

function removeGuideGateBlocks(player: ScriptPlayer): void {
  const playerDisappearObject = (player as any).disappearObject;
  if (typeof playerDisappearObject !== "function") {
    debugMessage({
      type: "muryeong-guide-gate:missing-disappearObject",
      playerId: player.id,
    });
    return;
  }

  for (let x = GUIDE_GATE_MIN_X; x <= GUIDE_GATE_MAX_X; x += 1) {
    playerDisappearObject.call(player, buildGuideGateKey(x));
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

function isInsideGuideGateBlockedZone(player: ScriptPlayer): boolean {
  const x = getTileCoordinate(player.tileX);
  const y = getTileCoordinate(player.tileY);
  return x >= GUIDE_GATE_MIN_X && x <= GUIDE_GATE_MAX_X && y <= GUIDE_GATE_Y;
}

function isInsideGuideGateWarningZone(player: ScriptPlayer): boolean {
  const x = getTileCoordinate(player.tileX);
  const y = getTileCoordinate(player.tileY);
  return (
    x >= GUIDE_GATE_MIN_X - WARNING_PADDING_X &&
    x <= GUIDE_GATE_MAX_X + WARNING_PADDING_X &&
    y >= GUIDE_GATE_Y &&
    y <= GUIDE_GATE_Y + WARNING_SAFE_TILE_COUNT
  );
}

function bounceBack(
  player: ScriptPlayer,
  target: { x: number; y: number } = {
    x: BOUNCE_TARGET_X,
    y: BOUNCE_TARGET_Y,
  }
): void {
  const tag = preparePlayerTag(player) as MuryeongGatePlayerTag;
  const now = Date.now();
  const lastBounceAt = Number(tag.muryeongGateLastBounceAt ?? 0);
  if (now - lastBounceAt < BOUNCE_COOLDOWN_MS) {
    return;
  }

  tag.muryeongGateLastBounceAt = now;
  player.spawnAt(target.x, target.y);
  player.sendUpdated();
}

export function syncMuryeongTombGate(
  player: ScriptPlayer,
  mapName: string
): void {
  if (!isMuryeongMap(mapName)) {
    return;
  }

  if (isBurialGoodsGuideComplete(player)) {
    removeGuideGateBlocks(player);
  } else {
    placeGuideGateBlocks(player);
  }

  if (areRequiredActivitiesComplete(player)) {
    removeGateBlocks(player);
    return;
  }

  placeGateBlocks(player);
}

export function handleMuryeongTombGateJoin(
  player: ScriptPlayer,
  mapName: string
): void {
  syncMuryeongTombGate(player, mapName);
}

export function handleMuryeongTombGateObjectKey(
  player: ScriptPlayer,
  key: unknown,
  mapName: string
): boolean {
  if (!isMuryeongMap(mapName)) {
    return false;
  }

  const parsed = parseGateKey(key);
  if (!parsed) {
    return false;
  }

  if (parsed.gateType === "guide") {
    if (isBurialGoodsGuideComplete(player)) {
      removeGuideGateBlocks(player);
      return true;
    }

    showBlockedMessage(player, {
      force: true,
      message: GUIDE_GATE_BLOCK_MESSAGE,
    });
    placeGuideGateBlocks(player);
    bounceBack(player, {
      x: GUIDE_GATE_BOUNCE_TARGET_X,
      y: GUIDE_GATE_BOUNCE_TARGET_Y,
    });
    return true;
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

export function registerMuryeongTombGateTiles(): void {
  for (let x = GUIDE_GATE_MIN_X; x <= GUIDE_GATE_MAX_X; x += 1) {
    ScriptApp.addOnTileTouched(x, GUIDE_GATE_Y, function (player: ScriptPlayer) {
      if (!isMuryeongMap(ScriptMap.name)) {
        return;
      }

      if (isBurialGoodsGuideComplete(player)) {
        removeGuideGateBlocks(player);
        return;
      }

      showBlockedMessage(player, {
        force: true,
        message: GUIDE_GATE_BLOCK_MESSAGE,
      });
      placeGuideGateBlocks(player);
      bounceBack(player, {
        x: GUIDE_GATE_BOUNCE_TARGET_X,
        y: GUIDE_GATE_BOUNCE_TARGET_Y,
      });
    });
  }

  for (let x = GATE_MIN_X; x <= GATE_MAX_X; x += 1) {
    ScriptApp.addOnTileTouched(x, GATE_Y, function (player: ScriptPlayer) {
      if (!isMuryeongMap(ScriptMap.name)) {
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

export function handleMuryeongTombGateUpdate(mapName: string): void {
  if (!isMuryeongMap(mapName)) {
    return;
  }

  ScriptApp.players.forEach(function (player) {
    if (isBurialGoodsGuideComplete(player)) {
      removeGuideGateBlocks(player);
    } else if (isInsideGuideGateBlockedZone(player)) {
      showBlockedMessage(player, {
        force: true,
        message: GUIDE_GATE_BLOCK_MESSAGE,
      });
      placeGuideGateBlocks(player);
      bounceBack(player, {
        x: GUIDE_GATE_BOUNCE_TARGET_X,
        y: GUIDE_GATE_BOUNCE_TARGET_Y,
      });
      return;
    } else if (isInsideGuideGateWarningZone(player)) {
      placeGuideGateBlocks(player);
      showBlockedMessage(player, {
        message: GUIDE_GATE_BLOCK_MESSAGE,
      });
    } else {
      placeGuideGateBlocks(player);
    }

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
