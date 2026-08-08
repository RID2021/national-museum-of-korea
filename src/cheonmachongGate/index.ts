import { ObjectEffectType, type ScriptPlayer } from "zep-script";

import { isMissionStepComplete } from "../missionProgress";
import { debugMessage } from "../utils/message";
import { preparePlayerTag } from "../utils/player";

const CHEONMACHONG_MAP_NAMES = [
  "천마총",
  "신라 천마총",
  "신라천마총",
];
const CHEONMACHONG_MISSION_ID = "cheonmachong";
const REQUIRED_INTRO_STEP_ID = "npc-dialog";
const REQUIRED_STRUCTURE_STEP_IDS = [
  "wooden-chamber",
  "stone-mound",
  "burial-mound",
];
const REQUIRED_COSTUME_STEP_ID = "gold-accessory-game";
const INTRO_GATE = {
  bounceX: 30,
  bounceY: 92,
  keyPrefix: "cheonmachong-intro-gate",
  maxX: 33,
  message: "석이를 먼저 만나고 이동하세요.",
  minX: 26,
  y: 91,
};
const STRUCTURE_GATE = {
  bounceX: 50,
  bounceY: 60,
  keyPrefix: "cheonmachong-structure-gate",
  maxX: 52,
  message: "덧널, 돌무지, 봉토를 모두 확인하고 이동하세요.",
  minX: 48,
  y: 59,
};
const COSTUME_GATE = {
  bounceX: 54,
  bounceY: 33,
  keyPrefix: "cheonmachong-costume-gate",
  maxX: 59,
  message: "복식 복원 활동을 완료하고 이동하세요.",
  minX: 49,
  y: 32,
};
const MESSAGE_COOLDOWN_MS = 1400;
const BOUNCE_COOLDOWN_MS = 500;
const WARNING_PADDING_X = 1;
const WARNING_SAFE_TILE_COUNT = 2;

const transparentGateSprite = ScriptApp.loadSpritesheet("images/transparent.png");

type GateType = "intro" | "structure" | "costume";

type CheonmachongGatePlayerTag = Record<string, unknown> & {
  cheonmachongCostumeGateLastBounceAt?: number;
  cheonmachongCostumeGateLastMessageAt?: number;
  cheonmachongGateLastBounceAt?: number;
  cheonmachongGateLastMessageAt?: number;
  cheonmachongIntroGateLastBounceAt?: number;
  cheonmachongIntroGateLastMessageAt?: number;
};

function isCheonmachongMap(mapName: string): boolean {
  const normalizedMapName = mapName.replace(/\s+/g, "");
  return (
    CHEONMACHONG_MAP_NAMES.includes(mapName) ||
    normalizedMapName.includes("천마총") ||
    normalizedMapName.toLowerCase().includes("cheonmachong")
  );
}

type GateConfig = typeof INTRO_GATE;

function getGateConfig(gateType: GateType): GateConfig {
  if (gateType === "intro") {
    return INTRO_GATE;
  }

  return gateType === "structure" ? STRUCTURE_GATE : COSTUME_GATE;
}

function buildGateKey(gateType: GateType, x: number): string {
  const gate = getGateConfig(gateType);
  return `${gate.keyPrefix}:${x}:${gate.y}`;
}

function parseGateKey(
  key: unknown
): { gateType: GateType; x: number; y: number } | null {
  if (typeof key !== "string") {
    return null;
  }

  let gateType: GateType;
  if (key.startsWith(`${INTRO_GATE.keyPrefix}:`)) {
    gateType = "intro";
  } else if (key.startsWith(`${STRUCTURE_GATE.keyPrefix}:`)) {
    gateType = "structure";
  } else if (key.startsWith(`${COSTUME_GATE.keyPrefix}:`)) {
    gateType = "costume";
  } else {
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

function isIntroComplete(player: ScriptPlayer): boolean {
  return isMissionStepComplete(
    player,
    CHEONMACHONG_MISSION_ID,
    REQUIRED_INTRO_STEP_ID
  );
}

function areRequiredStructuresComplete(player: ScriptPlayer): boolean {
  return REQUIRED_STRUCTURE_STEP_IDS.every(function (stepId) {
    return isMissionStepComplete(player, CHEONMACHONG_MISSION_ID, stepId);
  });
}

function isCostumeActivityComplete(player: ScriptPlayer): boolean {
  return isMissionStepComplete(
    player,
    CHEONMACHONG_MISSION_ID,
    REQUIRED_COSTUME_STEP_ID
  );
}

function isGateComplete(player: ScriptPlayer, gateType: GateType): boolean {
  if (gateType === "intro") {
    return isIntroComplete(player);
  }

  return gateType === "structure"
    ? areRequiredStructuresComplete(player)
    : isCostumeActivityComplete(player);
}

function getMessageTagKey(gateType: GateType): keyof CheonmachongGatePlayerTag {
  if (gateType === "intro") {
    return "cheonmachongIntroGateLastMessageAt";
  }

  return gateType === "structure"
    ? "cheonmachongGateLastMessageAt"
    : "cheonmachongCostumeGateLastMessageAt";
}

function getBounceTagKey(gateType: GateType): keyof CheonmachongGatePlayerTag {
  if (gateType === "intro") {
    return "cheonmachongIntroGateLastBounceAt";
  }

  return gateType === "structure"
    ? "cheonmachongGateLastBounceAt"
    : "cheonmachongCostumeGateLastBounceAt";
}

function showBlockedMessage(
  player: ScriptPlayer,
  gateType: GateType,
  options?: { force?: boolean }
): void {
  const tag = preparePlayerTag(player) as CheonmachongGatePlayerTag;
  const gate = getGateConfig(gateType);
  const tagKey = getMessageTagKey(gateType);
  const now = Date.now();
  const lastMessageAt = Number(tag[tagKey] ?? 0);

  if (!options?.force && now - lastMessageAt < MESSAGE_COOLDOWN_MS) {
    return;
  }

  tag[tagKey] = now;
  player.showCenterLabel(gate.message, 0xffffff, 0x000000, 420, 3000);
  player.sendUpdated();
}

function placeGateBlocks(player: ScriptPlayer, gateType: GateType): void {
  const playerPutIndividualObject = (player as any).putIndividualObject;
  const gate = getGateConfig(gateType);
  if (typeof playerPutIndividualObject !== "function") {
    debugMessage({
      type: `cheonmachong-${gateType}-gate:missing-putIndividualObject`,
      playerId: player.id,
    });
    return;
  }

  for (let x = gate.minX; x <= gate.maxX; x += 1) {
    playerPutIndividualObject.call(player, x, gate.y, transparentGateSprite, {
      type: ObjectEffectType.NONE,
      key: buildGateKey(gateType, x),
      overlap: true,
      impassable: true,
    });
  }
}

function removeGateBlocks(player: ScriptPlayer, gateType: GateType): void {
  const playerDisappearObject = (player as any).disappearObject;
  const gate = getGateConfig(gateType);
  if (typeof playerDisappearObject !== "function") {
    debugMessage({
      type: `cheonmachong-${gateType}-gate:missing-disappearObject`,
      playerId: player.id,
    });
    return;
  }

  for (let x = gate.minX; x <= gate.maxX; x += 1) {
    playerDisappearObject.call(player, buildGateKey(gateType, x));
  }
}

function getTileCoordinate(value: unknown): number {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? Math.floor(coordinate) : Number.NaN;
}

function isInsideBlockedGateZone(
  player: ScriptPlayer,
  gateType: GateType
): boolean {
  const gate = getGateConfig(gateType);
  const x = getTileCoordinate(player.tileX);
  const y = getTileCoordinate(player.tileY);
  return x >= gate.minX && x <= gate.maxX && y <= gate.y;
}

function isInsideGateWarningZone(
  player: ScriptPlayer,
  gateType: GateType
): boolean {
  const gate = getGateConfig(gateType);
  const x = getTileCoordinate(player.tileX);
  const y = getTileCoordinate(player.tileY);
  return (
    x >= gate.minX - WARNING_PADDING_X &&
    x <= gate.maxX + WARNING_PADDING_X &&
    y >= gate.y &&
    y <= gate.y + WARNING_SAFE_TILE_COUNT
  );
}

function bounceBack(player: ScriptPlayer, gateType: GateType): void {
  const tag = preparePlayerTag(player) as CheonmachongGatePlayerTag;
  const gate = getGateConfig(gateType);
  const tagKey = getBounceTagKey(gateType);
  const now = Date.now();
  const lastBounceAt = Number(tag[tagKey] ?? 0);
  if (now - lastBounceAt < BOUNCE_COOLDOWN_MS) {
    return;
  }

  tag[tagKey] = now;
  player.spawnAt(gate.bounceX, gate.bounceY);
  player.sendUpdated();
}

function syncOneGate(player: ScriptPlayer, gateType: GateType): void {
  if (isGateComplete(player, gateType)) {
    removeGateBlocks(player, gateType);
    return;
  }

  placeGateBlocks(player, gateType);
}

export function syncCheonmachongGate(
  player: ScriptPlayer,
  mapName: string
): void {
  if (!isCheonmachongMap(mapName)) {
    return;
  }

  syncOneGate(player, "intro");
  syncOneGate(player, "structure");
  syncOneGate(player, "costume");
}

export function handleCheonmachongGateJoin(
  player: ScriptPlayer,
  mapName: string
): void {
  syncCheonmachongGate(player, mapName);
}

export function handleCheonmachongGateObjectKey(
  player: ScriptPlayer,
  key: unknown,
  mapName: string
): boolean {
  if (!isCheonmachongMap(mapName)) {
    return false;
  }

  const parsed = parseGateKey(key);
  if (!parsed) {
    return false;
  }

  if (isGateComplete(player, parsed.gateType)) {
    removeGateBlocks(player, parsed.gateType);
    return true;
  }

  showBlockedMessage(player, parsed.gateType, { force: true });
  placeGateBlocks(player, parsed.gateType);
  bounceBack(player, parsed.gateType);
  return true;
}

export function registerCheonmachongGateTiles(): void {
  (["intro", "structure", "costume"] as GateType[]).forEach(function (gateType) {
    const gate = getGateConfig(gateType);
    for (let x = gate.minX; x <= gate.maxX; x += 1) {
      ScriptApp.addOnTileTouched(x, gate.y, function (player: ScriptPlayer) {
        if (!isCheonmachongMap(ScriptMap.name)) {
          return;
        }

        if (isGateComplete(player, gateType)) {
          removeGateBlocks(player, gateType);
          return;
        }

        showBlockedMessage(player, gateType, { force: true });
        placeGateBlocks(player, gateType);
        bounceBack(player, gateType);
      });
    }
  });
}

export function handleCheonmachongGateUpdate(mapName: string): void {
  if (!isCheonmachongMap(mapName)) {
    return;
  }

  ScriptApp.players.forEach(function (player) {
    (["intro", "structure", "costume"] as GateType[]).forEach(function (gateType) {
      if (isGateComplete(player, gateType)) {
        removeGateBlocks(player, gateType);
        return;
      }

      if (isInsideBlockedGateZone(player, gateType)) {
        showBlockedMessage(player, gateType, { force: true });
        placeGateBlocks(player, gateType);
        bounceBack(player, gateType);
        return;
      }

      if (isInsideGateWarningZone(player, gateType)) {
        showBlockedMessage(player, gateType);
      }
    });
  });
}
