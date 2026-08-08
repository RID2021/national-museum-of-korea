import { ObjectEffectType, type ScriptPlayer } from "zep-script";

import { isMissionStepComplete } from "../missionProgress";
import { debugMessage } from "../utils/message";
import { preparePlayerTag } from "../utils/player";

const ANAK_MAP_NAMES = [
  "안악 3호분",
  "고구려 안악 3호분",
  "안악3호분",
  "고구려안악3호분",
];
const ANAK_MISSION_ID = "anak-3";
const REQUIRED_MURAL_STEP_IDS = [
  "kitchen-mural",
  "meat-storage-mural",
  "well-mural",
];
const GATE_KEY_PREFIX = "anak-mural-gate";
const GATE_Y = 64;
const GATE_MIN_X = 47;
const GATE_MAX_X = 53;
const BOUNCE_TARGET_X = 19;
const BOUNCE_TARGET_Y = 75;
const BLOCK_MESSAGE = "모든 벽화를 확인 후 이동해주세요.";
const SEAT_GATE_KEY_PREFIX = "anak-seat-gate";
const SEAT_GATE_Y = 34;
const SEAT_GATE_MIN_X = 28;
const SEAT_GATE_MAX_X = 32;
const SEAT_GATE_REQUIRED_STEP_ID = "horse-handler-position";
const SEAT_GATE_BOUNCE_TARGET_X = 30;
const SEAT_GATE_BOUNCE_TARGET_Y = 35;
const SEAT_BLOCK_MESSAGE = "정답 자리를 먼저 확인해주세요.";
const INTRO_GATE_KEY_PREFIX = "anak-intro-gate";
const INTRO_GATE_Y = 94;
const INTRO_GATE_MIN_X = 28;
const INTRO_GATE_MAX_X = 31;
const INTRO_GATE_REQUIRED_STEP_ID = "npc-dialog";
const INTRO_GATE_BOUNCE_TARGET_Y = 95;
const INTRO_BLOCK_MESSAGE = "을씨와 먼저 대화하고 이동하세요.";
const MESSAGE_COOLDOWN_MS = 1400;
const BOUNCE_COOLDOWN_MS = 500;
const WARNING_PADDING_X = 1;
const WARNING_SAFE_TILE_COUNT = 2;

const transparentGateSprite = ScriptApp.loadSpritesheet("images/transparent.png");

type AnakMuralGatePlayerTag = Record<string, unknown> & {
  anakMuralGateLastBounceAt?: number;
  anakMuralGateLastMessageAt?: number;
  anakSeatGateLastBounceAt?: number;
  anakSeatGateLastMessageAt?: number;
  anakIntroGateLastBounceAt?: number;
  anakIntroGateLastMessageAt?: number;
};

function isAnakMap(mapName: string): boolean {
  const normalizedMapName = mapName.replace(/\s+/g, "");
  return (
    ANAK_MAP_NAMES.includes(mapName) ||
    normalizedMapName.includes("안악3호분") ||
    normalizedMapName.toLowerCase().includes("anak3")
  );
}

function buildGateKey(x: number): string {
  return `${GATE_KEY_PREFIX}:${x}:${GATE_Y}`;
}

function buildSeatGateKey(x: number): string {
  return `${SEAT_GATE_KEY_PREFIX}:${x}:${SEAT_GATE_Y}`;
}

function buildIntroGateKey(x: number): string {
  return `${INTRO_GATE_KEY_PREFIX}:${x}:${INTRO_GATE_Y}`;
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

function parseSeatGateKey(key: unknown): { x: number; y: number } | null {
  if (typeof key !== "string" || !key.startsWith(`${SEAT_GATE_KEY_PREFIX}:`)) {
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

function parseIntroGateKey(key: unknown): { x: number; y: number } | null {
  if (typeof key !== "string" || !key.startsWith(`${INTRO_GATE_KEY_PREFIX}:`)) {
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

function areRequiredMuralsComplete(player: ScriptPlayer): boolean {
  return REQUIRED_MURAL_STEP_IDS.every(function (stepId) {
    return isMissionStepComplete(player, ANAK_MISSION_ID, stepId);
  });
}

function isCorrectSeatComplete(player: ScriptPlayer): boolean {
  return isMissionStepComplete(
    player,
    ANAK_MISSION_ID,
    SEAT_GATE_REQUIRED_STEP_ID
  );
}

function isIntroComplete(player: ScriptPlayer): boolean {
  return isMissionStepComplete(
    player,
    ANAK_MISSION_ID,
    INTRO_GATE_REQUIRED_STEP_ID
  );
}

function showBlockedMessage(
  player: ScriptPlayer,
  options?: { force?: boolean }
): void {
  const tag = preparePlayerTag(player) as AnakMuralGatePlayerTag;
  const now = Date.now();
  const lastMessageAt = Number(tag.anakMuralGateLastMessageAt ?? 0);

  if (!options?.force && now - lastMessageAt < MESSAGE_COOLDOWN_MS) {
    return;
  }

  tag.anakMuralGateLastMessageAt = now;
  player.showCenterLabel(BLOCK_MESSAGE, 0xffffff, 0x000000, 420, 3000);
  player.sendUpdated();
}

function showSeatBlockedMessage(
  player: ScriptPlayer,
  options?: { force?: boolean }
): void {
  const tag = preparePlayerTag(player) as AnakMuralGatePlayerTag;
  const now = Date.now();
  const lastMessageAt = Number(tag.anakSeatGateLastMessageAt ?? 0);

  if (!options?.force && now - lastMessageAt < MESSAGE_COOLDOWN_MS) {
    return;
  }

  tag.anakSeatGateLastMessageAt = now;
  player.showCenterLabel(SEAT_BLOCK_MESSAGE, 0xffffff, 0x000000, 420, 3000);
  player.sendUpdated();
}

function showIntroBlockedMessage(
  player: ScriptPlayer,
  options?: { force?: boolean }
): void {
  const tag = preparePlayerTag(player) as AnakMuralGatePlayerTag;
  const now = Date.now();
  const lastMessageAt = Number(tag.anakIntroGateLastMessageAt ?? 0);

  if (!options?.force && now - lastMessageAt < MESSAGE_COOLDOWN_MS) {
    return;
  }

  tag.anakIntroGateLastMessageAt = now;
  player.showCenterLabel(INTRO_BLOCK_MESSAGE, 0xffffff, 0x000000, 420, 3000);
  player.sendUpdated();
}

function placeGateBlocks(player: ScriptPlayer): void {
  const playerPutIndividualObject = (player as any).putIndividualObject;
  if (typeof playerPutIndividualObject !== "function") {
    debugMessage({
      type: "anak-mural-gate:missing-putIndividualObject",
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

function placeSeatGateBlocks(player: ScriptPlayer): void {
  const playerPutIndividualObject = (player as any).putIndividualObject;
  if (typeof playerPutIndividualObject !== "function") {
    debugMessage({
      type: "anak-seat-gate:missing-putIndividualObject",
      playerId: player.id,
    });
    return;
  }

  for (let x = SEAT_GATE_MIN_X; x <= SEAT_GATE_MAX_X; x += 1) {
    playerPutIndividualObject.call(player, x, SEAT_GATE_Y, transparentGateSprite, {
      type: ObjectEffectType.NONE,
      key: buildSeatGateKey(x),
      overlap: true,
      impassable: true,
    });
  }
}

function placeIntroGateBlocks(player: ScriptPlayer): void {
  const playerPutIndividualObject = (player as any).putIndividualObject;
  if (typeof playerPutIndividualObject !== "function") {
    debugMessage({
      type: "anak-intro-gate:missing-putIndividualObject",
      playerId: player.id,
    });
    return;
  }

  for (let x = INTRO_GATE_MIN_X; x <= INTRO_GATE_MAX_X; x += 1) {
    playerPutIndividualObject.call(player, x, INTRO_GATE_Y, transparentGateSprite, {
      type: ObjectEffectType.NONE,
      key: buildIntroGateKey(x),
      overlap: true,
      impassable: true,
    });
  }
}

function removeGateBlocks(player: ScriptPlayer): void {
  const playerDisappearObject = (player as any).disappearObject;
  if (typeof playerDisappearObject !== "function") {
    debugMessage({
      type: "anak-mural-gate:missing-disappearObject",
      playerId: player.id,
    });
    return;
  }

  for (let x = GATE_MIN_X; x <= GATE_MAX_X; x += 1) {
    playerDisappearObject.call(player, buildGateKey(x));
  }
}

function removeSeatGateBlocks(player: ScriptPlayer): void {
  const playerDisappearObject = (player as any).disappearObject;
  if (typeof playerDisappearObject !== "function") {
    debugMessage({
      type: "anak-seat-gate:missing-disappearObject",
      playerId: player.id,
    });
    return;
  }

  for (let x = SEAT_GATE_MIN_X; x <= SEAT_GATE_MAX_X; x += 1) {
    playerDisappearObject.call(player, buildSeatGateKey(x));
  }
}

function removeIntroGateBlocks(player: ScriptPlayer): void {
  const playerDisappearObject = (player as any).disappearObject;
  if (typeof playerDisappearObject !== "function") {
    debugMessage({
      type: "anak-intro-gate:missing-disappearObject",
      playerId: player.id,
    });
    return;
  }

  for (let x = INTRO_GATE_MIN_X; x <= INTRO_GATE_MAX_X; x += 1) {
    playerDisappearObject.call(player, buildIntroGateKey(x));
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

function isInsideBlockedSeatGateZone(player: ScriptPlayer): boolean {
  const x = getTileCoordinate(player.tileX);
  const y = getTileCoordinate(player.tileY);
  return x >= SEAT_GATE_MIN_X && x <= SEAT_GATE_MAX_X && y <= SEAT_GATE_Y;
}

function isInsideBlockedIntroGateZone(player: ScriptPlayer): boolean {
  const x = getTileCoordinate(player.tileX);
  const y = getTileCoordinate(player.tileY);
  return x >= INTRO_GATE_MIN_X && x <= INTRO_GATE_MAX_X && y <= INTRO_GATE_Y;
}

function isInsideSeatGateWarningZone(player: ScriptPlayer): boolean {
  const x = getTileCoordinate(player.tileX);
  const y = getTileCoordinate(player.tileY);
  return (
    x >= SEAT_GATE_MIN_X - WARNING_PADDING_X &&
    x <= SEAT_GATE_MAX_X + WARNING_PADDING_X &&
    y >= SEAT_GATE_Y &&
    y <= SEAT_GATE_Y + WARNING_SAFE_TILE_COUNT
  );
}

function isInsideIntroGateWarningZone(player: ScriptPlayer): boolean {
  const x = getTileCoordinate(player.tileX);
  const y = getTileCoordinate(player.tileY);
  return (
    x >= INTRO_GATE_MIN_X - WARNING_PADDING_X &&
    x <= INTRO_GATE_MAX_X + WARNING_PADDING_X &&
    y >= INTRO_GATE_Y &&
    y <= INTRO_GATE_Y + WARNING_SAFE_TILE_COUNT
  );
}

function bounceBack(player: ScriptPlayer): void {
  const tag = preparePlayerTag(player) as AnakMuralGatePlayerTag;
  const now = Date.now();
  const lastBounceAt = Number(tag.anakMuralGateLastBounceAt ?? 0);
  if (now - lastBounceAt < BOUNCE_COOLDOWN_MS) {
    return;
  }

  tag.anakMuralGateLastBounceAt = now;
  player.spawnAt(BOUNCE_TARGET_X, BOUNCE_TARGET_Y);
  player.sendUpdated();
}

function bounceBackFromSeatGate(player: ScriptPlayer): void {
  const tag = preparePlayerTag(player) as AnakMuralGatePlayerTag;
  const now = Date.now();
  const lastBounceAt = Number(tag.anakSeatGateLastBounceAt ?? 0);
  if (now - lastBounceAt < BOUNCE_COOLDOWN_MS) {
    return;
  }

  tag.anakSeatGateLastBounceAt = now;
  player.spawnAt(SEAT_GATE_BOUNCE_TARGET_X, SEAT_GATE_BOUNCE_TARGET_Y);
  player.sendUpdated();
}

function bounceBackFromIntroGate(player: ScriptPlayer): void {
  const tag = preparePlayerTag(player) as AnakMuralGatePlayerTag;
  const now = Date.now();
  const lastBounceAt = Number(tag.anakIntroGateLastBounceAt ?? 0);
  if (now - lastBounceAt < BOUNCE_COOLDOWN_MS) {
    return;
  }

  tag.anakIntroGateLastBounceAt = now;
  const x = Math.max(
    INTRO_GATE_MIN_X,
    Math.min(INTRO_GATE_MAX_X, getTileCoordinate(player.tileX))
  );
  player.spawnAt(Number.isFinite(x) ? x : INTRO_GATE_MIN_X, INTRO_GATE_BOUNCE_TARGET_Y);
  player.sendUpdated();
}

export function syncAnakMuralGate(
  player: ScriptPlayer,
  mapName: string
): void {
  if (!isAnakMap(mapName)) {
    return;
  }

  if (areRequiredMuralsComplete(player)) {
    removeGateBlocks(player);
  } else {
    placeGateBlocks(player);
  }

  if (isCorrectSeatComplete(player)) {
    removeSeatGateBlocks(player);
  } else {
    placeSeatGateBlocks(player);
  }

  if (isIntroComplete(player)) {
    removeIntroGateBlocks(player);
  } else {
    placeIntroGateBlocks(player);
  }
}

export function handleAnakMuralGateJoin(
  player: ScriptPlayer,
  mapName: string
): void {
  syncAnakMuralGate(player, mapName);
}

export function handleAnakMuralGateObjectKey(
  player: ScriptPlayer,
  key: unknown,
  mapName: string
): boolean {
  if (!isAnakMap(mapName)) {
    return false;
  }

  const parsedMuralGate = parseGateKey(key);
  if (parsedMuralGate) {
    if (areRequiredMuralsComplete(player)) {
      removeGateBlocks(player);
      return true;
    }

    showBlockedMessage(player, { force: true });
    placeGateBlocks(player);
    return true;
  }

  const parsedSeatGate = parseSeatGateKey(key);
  if (parsedSeatGate) {
    if (isCorrectSeatComplete(player)) {
      removeSeatGateBlocks(player);
      return true;
    }

    showSeatBlockedMessage(player, { force: true });
    placeSeatGateBlocks(player);
    bounceBackFromSeatGate(player);
    return true;
  }

  const parsedIntroGate = parseIntroGateKey(key);
  if (parsedIntroGate) {
    if (isIntroComplete(player)) {
      removeIntroGateBlocks(player);
      return true;
    }

    showIntroBlockedMessage(player, { force: true });
    placeIntroGateBlocks(player);
    bounceBackFromIntroGate(player);
    return true;
  }

  return false;
}

export function registerAnakMuralGateTiles(): void {
  for (let x = GATE_MIN_X; x <= GATE_MAX_X; x += 1) {
    ScriptApp.addOnTileTouched(x, GATE_Y, function (player: ScriptPlayer) {
      if (!isAnakMap(ScriptMap.name)) {
        return;
      }

      if (areRequiredMuralsComplete(player)) {
        removeGateBlocks(player);
        return;
      }

      showBlockedMessage(player, { force: true });
      placeGateBlocks(player);
      bounceBack(player);
    });
  }

  for (let x = SEAT_GATE_MIN_X; x <= SEAT_GATE_MAX_X; x += 1) {
    ScriptApp.addOnTileTouched(x, SEAT_GATE_Y, function (player: ScriptPlayer) {
      if (!isAnakMap(ScriptMap.name)) {
        return;
      }

      if (isCorrectSeatComplete(player)) {
        removeSeatGateBlocks(player);
        return;
      }

      showSeatBlockedMessage(player, { force: true });
      placeSeatGateBlocks(player);
      bounceBackFromSeatGate(player);
    });
  }

  for (let x = INTRO_GATE_MIN_X; x <= INTRO_GATE_MAX_X; x += 1) {
    ScriptApp.addOnTileTouched(x, INTRO_GATE_Y, function (player: ScriptPlayer) {
      if (!isAnakMap(ScriptMap.name)) {
        return;
      }

      if (isIntroComplete(player)) {
        removeIntroGateBlocks(player);
        return;
      }

      showIntroBlockedMessage(player, { force: true });
      placeIntroGateBlocks(player);
      bounceBackFromIntroGate(player);
    });
  }
}

export function handleAnakMuralGateUpdate(mapName: string): void {
  if (!isAnakMap(mapName)) {
    return;
  }

  ScriptApp.players.forEach(function (player) {
    if (areRequiredMuralsComplete(player)) {
      removeGateBlocks(player);
    } else if (isInsideBlockedGateZone(player)) {
      showBlockedMessage(player, { force: true });
      placeGateBlocks(player);
      bounceBack(player);
    } else if (isInsideGateWarningZone(player)) {
      showBlockedMessage(player);
    }

    if (isCorrectSeatComplete(player)) {
      removeSeatGateBlocks(player);
    } else if (isInsideBlockedSeatGateZone(player)) {
      showSeatBlockedMessage(player, { force: true });
      placeSeatGateBlocks(player);
      bounceBackFromSeatGate(player);
    } else if (isInsideSeatGateWarningZone(player)) {
      showSeatBlockedMessage(player);
    }

    if (isIntroComplete(player)) {
      removeIntroGateBlocks(player);
    } else if (isInsideBlockedIntroGateZone(player)) {
      showIntroBlockedMessage(player, { force: true });
      placeIntroGateBlocks(player);
      bounceBackFromIntroGate(player);
    } else if (isInsideIntroGateWarningZone(player)) {
      showIntroBlockedMessage(player);
    }
  });
}
