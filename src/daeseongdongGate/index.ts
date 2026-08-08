import { ObjectEffectType, type ScriptPlayer } from "zep-script";

import { isMissionStepComplete } from "../missionProgress";
import { debugMessage } from "../utils/message";
import { preparePlayerTag } from "../utils/player";

const DAESEONGDONG_MAP_NAMES = [
  "대성동 고분군",
  "가야 대성동 고분군",
  "가야대성동고분군",
];
const DAESEONGDONG_MISSION_ID = "daeseongdong";
const MESSAGE_COOLDOWN_MS = 1400;
const BOUNCE_COOLDOWN_MS = 500;
const WARNING_PADDING_X = 1;
const WARNING_SAFE_TILE_COUNT = 2;

const transparentGateSprite = ScriptApp.loadSpritesheet("images/transparent.png");

type DaeseongdongGateDefinition = {
  keyPrefix: string;
  requiredStepId: string;
  y: number;
  minX: number;
  maxX: number;
  bounceTargetY: number;
  message: string;
};

type DaeseongdongGatePlayerTag = Record<string, unknown> & {
  daeseongdongGateLastBounceAt?: number;
  daeseongdongGateLastMessageAt?: number;
};

const DAESEONGDONG_GATES: DaeseongdongGateDefinition[] = [
  {
    keyPrefix: "daeseongdong-iron-process-gate",
    requiredStepId: "iron-process-game",
    y: 67,
    minX: 26,
    maxX: 33,
    bounceTargetY: 68,
    message: "철 생산 순서 미션을 완료하고 이동하세요.",
  },
  {
    keyPrefix: "daeseongdong-artifact-match-gate",
    requiredStepId: "artifact-use-quiz",
    y: 34,
    minX: 49,
    maxX: 52,
    bounceTargetY: 35,
    message: "미션을 모두 수행하고 이동하세요.",
  },
];

function isDaeseongdongMap(mapName: string): boolean {
  const normalizedMapName = mapName.replace(/\s+/g, "");
  return (
    DAESEONGDONG_MAP_NAMES.includes(mapName) ||
    normalizedMapName.includes("대성동고분군") ||
    normalizedMapName.toLowerCase().includes("daeseongdong")
  );
}

function buildGateKey(gate: DaeseongdongGateDefinition, x: number): string {
  return `${gate.keyPrefix}:${x}:${gate.y}`;
}

function parseGateKey(
  key: unknown
): { gate: DaeseongdongGateDefinition; x: number; y: number } | null {
  if (typeof key !== "string") {
    return null;
  }

  const gate = DAESEONGDONG_GATES.find(function (candidate) {
    return key.startsWith(`${candidate.keyPrefix}:`);
  });

  if (!gate) {
    return null;
  }

  const [rawX, rawY] = key.replace(`${gate.keyPrefix}:`, "").split(":");
  const x = Number.parseInt(rawX ?? "", 10);
  const y = Number.parseInt(rawY ?? "", 10);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { gate, x, y };
}

function isGateComplete(
  player: ScriptPlayer,
  gate: DaeseongdongGateDefinition
): boolean {
  return isMissionStepComplete(
    player,
    DAESEONGDONG_MISSION_ID,
    gate.requiredStepId
  );
}

function showBlockedMessage(
  player: ScriptPlayer,
  gate: DaeseongdongGateDefinition,
  options?: { force?: boolean }
): void {
  const tag = preparePlayerTag(player) as DaeseongdongGatePlayerTag;
  const now = Date.now();
  const lastMessageAt = Number(tag.daeseongdongGateLastMessageAt ?? 0);

  if (!options?.force && now - lastMessageAt < MESSAGE_COOLDOWN_MS) {
    return;
  }

  tag.daeseongdongGateLastMessageAt = now;
  player.showCenterLabel(gate.message, 0xffffff, 0x000000, 420, 3000);
  player.sendUpdated();
}

function placeGateBlocks(
  player: ScriptPlayer,
  gate: DaeseongdongGateDefinition
): void {
  const playerPutIndividualObject = (player as any).putIndividualObject;
  if (typeof playerPutIndividualObject !== "function") {
    debugMessage({
      type: "daeseongdong-gate:missing-putIndividualObject",
      playerId: player.id,
    });
    return;
  }

  for (let x = gate.minX; x <= gate.maxX; x += 1) {
    playerPutIndividualObject.call(player, x, gate.y, transparentGateSprite, {
      type: ObjectEffectType.NONE,
      key: buildGateKey(gate, x),
      overlap: true,
      impassable: true,
    });
  }
}

function removeGateBlocks(
  player: ScriptPlayer,
  gate: DaeseongdongGateDefinition
): void {
  const playerDisappearObject = (player as any).disappearObject;
  if (typeof playerDisappearObject !== "function") {
    debugMessage({
      type: "daeseongdong-gate:missing-disappearObject",
      playerId: player.id,
    });
    return;
  }

  for (let x = gate.minX; x <= gate.maxX; x += 1) {
    playerDisappearObject.call(player, buildGateKey(gate, x));
  }
}

function getTileCoordinate(value: unknown): number {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? Math.floor(coordinate) : Number.NaN;
}

function getBounceTargetX(
  player: ScriptPlayer,
  gate: DaeseongdongGateDefinition
): number {
  const x = getTileCoordinate(player.tileX);
  if (!Number.isFinite(x)) {
    return Math.floor((gate.minX + gate.maxX) / 2);
  }

  return Math.max(gate.minX, Math.min(gate.maxX, x));
}

function isInsideBlockedGateZone(
  player: ScriptPlayer,
  gate: DaeseongdongGateDefinition
): boolean {
  const x = getTileCoordinate(player.tileX);
  const y = getTileCoordinate(player.tileY);
  return x >= gate.minX && x <= gate.maxX && y <= gate.y;
}

function isInsideGateWarningZone(
  player: ScriptPlayer,
  gate: DaeseongdongGateDefinition
): boolean {
  const x = getTileCoordinate(player.tileX);
  const y = getTileCoordinate(player.tileY);
  return (
    x >= gate.minX - WARNING_PADDING_X &&
    x <= gate.maxX + WARNING_PADDING_X &&
    y >= gate.y &&
    y <= gate.y + WARNING_SAFE_TILE_COUNT
  );
}

function bounceBack(
  player: ScriptPlayer,
  gate: DaeseongdongGateDefinition
): void {
  const tag = preparePlayerTag(player) as DaeseongdongGatePlayerTag;
  const now = Date.now();
  const lastBounceAt = Number(tag.daeseongdongGateLastBounceAt ?? 0);
  if (now - lastBounceAt < BOUNCE_COOLDOWN_MS) {
    return;
  }

  tag.daeseongdongGateLastBounceAt = now;
  player.spawnAt(getBounceTargetX(player, gate), gate.bounceTargetY);
  player.sendUpdated();
}

export function syncDaeseongdongGate(
  player: ScriptPlayer,
  mapName: string
): void {
  if (!isDaeseongdongMap(mapName)) {
    return;
  }

  DAESEONGDONG_GATES.forEach(function (gate) {
    if (isGateComplete(player, gate)) {
      removeGateBlocks(player, gate);
      return;
    }

    placeGateBlocks(player, gate);
  });
}

export function handleDaeseongdongGateJoin(
  player: ScriptPlayer,
  mapName: string
): void {
  syncDaeseongdongGate(player, mapName);
}

export function handleDaeseongdongGateObjectKey(
  player: ScriptPlayer,
  key: unknown,
  mapName: string
): boolean {
  if (!isDaeseongdongMap(mapName)) {
    return false;
  }

  const parsed = parseGateKey(key);
  if (!parsed) {
    return false;
  }

  if (isGateComplete(player, parsed.gate)) {
    removeGateBlocks(player, parsed.gate);
    return true;
  }

  showBlockedMessage(player, parsed.gate, { force: true });
  placeGateBlocks(player, parsed.gate);
  bounceBack(player, parsed.gate);
  return true;
}

export function registerDaeseongdongGateTiles(): void {
  DAESEONGDONG_GATES.forEach(function (gate) {
    for (let x = gate.minX; x <= gate.maxX; x += 1) {
      ScriptApp.addOnTileTouched(x, gate.y, function (player: ScriptPlayer) {
        if (!isDaeseongdongMap(ScriptMap.name)) {
          return;
        }

        if (isGateComplete(player, gate)) {
          removeGateBlocks(player, gate);
          return;
        }

        showBlockedMessage(player, gate, { force: true });
        placeGateBlocks(player, gate);
        bounceBack(player, gate);
      });
    }
  });
}

export function handleDaeseongdongGateUpdate(mapName: string): void {
  if (!isDaeseongdongMap(mapName)) {
    return;
  }

  ScriptApp.players.forEach(function (player) {
    DAESEONGDONG_GATES.forEach(function (gate) {
      if (isGateComplete(player, gate)) {
        removeGateBlocks(player, gate);
        return;
      }

      if (isInsideBlockedGateZone(player, gate)) {
        showBlockedMessage(player, gate, { force: true });
        placeGateBlocks(player, gate);
        bounceBack(player, gate);
        return;
      }

      if (isInsideGateWarningZone(player, gate)) {
        showBlockedMessage(player, gate);
      }
    });
  });
}
