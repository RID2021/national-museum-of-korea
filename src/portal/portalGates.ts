import { ObjectEffectType, type ScriptPlayer } from "zep-script";

import { getInventory } from "../inventory";
import { markMissionStepComplete } from "../missionProgress";
import { debugMessage } from "../utils/message";
import { portalGateMap, type PortalGateEntry } from "./constants";

const PORTAL_GATE_KEY_PREFIX = "portal-gate";
const PORTAL_GATE_RADIUS = 2;
const TIME_PLAZA_MAP_NAME = "시간 광장";
const FINAL_MIRROR_ROOM_SOURCE_MAP_HASH_ID = "AOrYmW";
const FINAL_MIRROR_ROOM_MAP_HASH_ID = "qnYlZ3";
const FINAL_MIRROR_ROOM_TRIGGER_ALIASES = Object.freeze([
  "portal:mirror-room",
  "portal:mirror-room:gate",
  "portal:final",
  "portal:qnYlZ3",
  "mirror-room-gate",
  "mirror-room-portal",
  "mirror-room-unlock",
  "final-mirror-room-gate",
  "final-portal",
  "거울방입장조건",
  "거울의방입장",
  "거울의방포탈",
  "최종포탈",
]);
const FINAL_MIRROR_ROOM_REQUIRED_ITEMS = Object.freeze([
  "청동거울 조각 ①번",
  "청동거울 조각 ②번",
  "청동거울 조각 ③번",
  "청동거울 조각 ④번",
  "청동거울 조각 ⑤번",
  "시루떡",
  "활과 화살",
  "금송 조각",
  "서역계 유리잔",
  "철제 갑옷",
]);

const portalGateSprite = ScriptApp.loadSpritesheet("images/transparent.png");
const registeredFinalMirrorRoomLocationNames = new Set<string>();
const registeredFinalMirrorRoomTileKeys = new Set<string>();
const finalMirrorRoomTeleportingPlayerIds = new Set<string>();

type GatePlacement = {
  key: string;
  x: number;
  y: number;
  impassable: boolean;
};

function buildGateBlockKey(
  portalX: number,
  portalY: number,
  kind: "wall" | "buffer",
  x: number,
  y: number
): string {
  return `${PORTAL_GATE_KEY_PREFIX}:${portalX}:${portalY}:${kind}:${x}:${y}`;
}

function parseGateBlockKey(
  key: string
): { portalX: number; portalY: number } | null {
  if (typeof key !== "string") {
    return null;
  }

  if (!key.startsWith(`${PORTAL_GATE_KEY_PREFIX}:`)) {
    return null;
  }

  const parts = key.split(":");
  if (parts.length < 4) {
    return null;
  }

  const portalX = Number.parseInt(parts[1] ?? "", 10);
  const portalY = Number.parseInt(parts[2] ?? "", 10);
  if (!Number.isFinite(portalX) || !Number.isFinite(portalY)) {
    return null;
  }

  return { portalX, portalY };
}

function getCurrentMapHashId(): string {
  // ZEP's builder rewrites ScriptApp.member to App.member, not bare aliases.
  const mapHashId: unknown = ScriptApp.mapHashID;
  return typeof mapHashId === "string"
    ? mapHashId.trim()
    : "";
}

function getPortalGateEntries(mapName: string): PortalGateEntry[] {
  const mapKeys = new Set<string>();
  if (mapName.trim()) {
    mapKeys.add(mapName);
  }

  const currentMapHashId = getCurrentMapHashId();
  if (currentMapHashId) {
    mapKeys.add(currentMapHashId);
  }

  if (currentMapHashId === FINAL_MIRROR_ROOM_SOURCE_MAP_HASH_ID) {
    mapKeys.add(TIME_PLAZA_MAP_NAME);
  }

  return Array.from(mapKeys).flatMap(function (mapKey) {
    const entries = portalGateMap[mapKey];
    return Array.isArray(entries) ? entries : [];
  });
}

function buildGatePlacements(
  portalX: number,
  portalY: number,
  portalSize: number
): GatePlacement[] {
  const portalMinX = portalX;
  const portalMinY = portalY;
  const portalMaxX = portalX + (portalSize - 1);
  const portalMaxY = portalY + (portalSize - 1);

  const wallMinX = portalMinX - 1;
  const wallMinY = portalMinY - 1;
  const wallMaxX = portalMaxX + 1;
  const wallMaxY = portalMaxY + 1;

  const bufferMinX = portalMinX - PORTAL_GATE_RADIUS;
  const bufferMinY = portalMinY - PORTAL_GATE_RADIUS;
  const bufferMaxX = portalMaxX + PORTAL_GATE_RADIUS;
  const bufferMaxY = portalMaxY + PORTAL_GATE_RADIUS;

  const placements: GatePlacement[] = [];

  for (let x = wallMinX; x <= wallMaxX; x += 1) {
    for (let y = wallMinY; y <= wallMaxY; y += 1) {
      if (x < 0 || y < 0) {
        continue;
      }

      const isPortalTile =
        x >= portalMinX && x <= portalMaxX && y >= portalMinY && y <= portalMaxY;
      if (isPortalTile) {
        continue;
      }

      placements.push({
        key: buildGateBlockKey(portalX, portalY, "wall", x, y),
        x,
        y,
        impassable: true,
      });
    }
  }

  for (let x = bufferMinX; x <= bufferMaxX; x += 1) {
    for (let y = bufferMinY; y <= bufferMaxY; y += 1) {
      if (x < 0 || y < 0) {
        continue;
      }

      const isPerimeter =
        x === bufferMinX ||
        x === bufferMaxX ||
        y === bufferMinY ||
        y === bufferMaxY;
      if (!isPerimeter) {
        continue;
      }

      placements.push({
        key: buildGateBlockKey(portalX, portalY, "buffer", x, y),
        x,
        y,
        impassable: false,
      });
    }
  }

  return placements;
}

function findPortalEntry(
  mapName: string,
  portalX: number,
  portalY: number
): PortalGateEntry | null {
  const entries = getPortalGateEntries(mapName);
  const match = entries.find(function (entry) {
    return entry.portalX === portalX && entry.portalY === portalY;
  });

  return match ?? null;
}

function getMissingRequiredItems(
  player: ScriptPlayer,
  requiredItems: string[]
): string[] {
  if (!Array.isArray(requiredItems) || requiredItems.length === 0) {
    return [];
  }

  const inventory = getInventory(player);
  const ownedNames = new Set(
    inventory.items.map(function (item) {
      return item.name;
    })
  );

  return requiredItems.filter(function (name) {
    return !ownedNames.has(name);
  });
}

function showGateMissingMessage(
  player: ScriptPlayer,
  missing: string[],
  customMessage?: string
): void {
  const message = customMessage?.trim()
    ? customMessage.trim()
    : player.isMobile
      ? `부족한 아이템:\n${missing.join("\n")}`
      : `부족한 아이템: ${missing.join(", ")}`;

  player.showCustomLabel(
    message,
    0xffffff,
    0x000000,
    0,
    player.isMobile ? 65 : 55,
    0.6,
    4000,
    {
      borderRadius: "8px",
      padding: "4px",
    }
  );
  player.sendUpdated();
}

function isFinalMirrorRoomTrigger(key: unknown): boolean {
  if (typeof key !== "string") {
    return false;
  }

  const normalizedKey = key.trim();
  if (!normalizedKey) {
    return false;
  }

  return FINAL_MIRROR_ROOM_TRIGGER_ALIASES.includes(normalizedKey);
}

function showFinalMirrorRoomMissingMessage(
  player: ScriptPlayer,
  missing: string[]
): void {
  const missingText = player.isMobile ? missing.join("\n") : missing.join(", ");
  const message = player.isMobile
    ? `거울 조각과 사후 세계 물건을 모두 모아야 들어갈 수 있습니다.\n\n부족한 아이템:\n${missingText}`
    : `거울 조각과 사후 세계 물건을 모두 모아야 들어갈 수 있습니다.\n부족한 아이템: ${missingText}`;

  showGateMissingMessage(player, missing, message);
}

function moveToFinalMirrorRoom(player: ScriptPlayer): void {
  if (finalMirrorRoomTeleportingPlayerIds.has(player.id)) {
    return;
  }

  finalMirrorRoomTeleportingPlayerIds.add(player.id);
  markMissionStepComplete(player, "time-plaza", "mirror-room-unlock");

  player.showCustomLabel(
    "거울의 방으로 이동합니다.",
    0xffffff,
    0x000000,
    0,
    player.isMobile ? 65 : 55,
    0.68,
    1200,
    {
      borderRadius: "8px",
      padding: "4px",
    }
  );
  player.sendUpdated();

  setTimeout(function () {
    player.spawnAtMap(ScriptApp.spaceHashID, FINAL_MIRROR_ROOM_MAP_HASH_ID);
    finalMirrorRoomTeleportingPlayerIds.delete(player.id);
  }, 300);
}

function bounceFromFinalMirrorRoomTrigger(player: ScriptPlayer): void {
  player.spawnAt(60, 42);
  player.sendUpdated();
}

function registerFinalMirrorRoomPortalTiles(locationName: string): void {
  if (!ScriptMap.hasLocation(locationName)) {
    return;
  }

  const locations = ScriptMap.getLocationList(locationName);
  if (!Array.isArray(locations)) {
    return;
  }

  locations.forEach(function (point) {
    const x = Math.floor(Number(point.x));
    const y = Math.floor(Number(point.y));
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }

    const tileKey = `${locationName}:${x}:${y}`;
    if (registeredFinalMirrorRoomTileKeys.has(tileKey)) {
      return;
    }

    registeredFinalMirrorRoomTileKeys.add(tileKey);
    ScriptApp.addOnTileTouched(x, y, function (player: ScriptPlayer) {
      handleFinalMirrorRoomPortal(player, locationName, ScriptMap.name);
    });
  });
}

function placeGateBlocks(player: ScriptPlayer, entry: PortalGateEntry): void {
  const placements = buildGatePlacements(
    entry.portalX,
    entry.portalY,
    entry.portalSize
  );
  const playerPutIndividualObject = (player as any).putIndividualObject;

  if (typeof playerPutIndividualObject !== "function") {
    debugMessage({
      type: "portal-gate:missing-putIndividualObject",
      playerId: player.id,
    });
    return;
  }

  placements.forEach(function (placement) {
    playerPutIndividualObject.call(player, placement.x, placement.y, portalGateSprite, {
      type: ObjectEffectType.NONE,
      key: placement.key,
      overlap: true,
      impassable: placement.impassable,
    });
  });
}

function removeGateBlocks(player: ScriptPlayer, entry: PortalGateEntry): void {
  const placements = buildGatePlacements(
    entry.portalX,
    entry.portalY,
    entry.portalSize
  );
  const playerDisappearObject = (player as any).disappearObject;

  if (typeof playerDisappearObject !== "function") {
    debugMessage({
      type: "portal-gate:missing-disappearObject",
      playerId: player.id,
    });
    return;
  }

  placements.forEach(function (placement) {
    playerDisappearObject.call(player, placement.key);
  });
}

export function handlePortalGateJoin(player: ScriptPlayer, mapName: string): void {
  const entries = getPortalGateEntries(mapName);
  if (entries.length === 0) {
    return;
  }

  entries.forEach(function (entry) {
    if (!Array.isArray(entry.requiredItems) || entry.requiredItems.length === 0) {
      return;
    }

    const missing = getMissingRequiredItems(player, entry.requiredItems);
    if (missing.length === 0) {
      return;
    }

    placeGateBlocks(player, entry);
  });
}

export function handleFinalMirrorRoomPortal(
  player: ScriptPlayer,
  key: unknown,
  _mapName: string
): boolean {
  if (!isFinalMirrorRoomTrigger(key)) {
    return false;
  }

  const missing = getMissingRequiredItems(
    player,
    FINAL_MIRROR_ROOM_REQUIRED_ITEMS as unknown as string[]
  );
  if (missing.length > 0) {
    bounceFromFinalMirrorRoomTrigger(player);
    showFinalMirrorRoomMissingMessage(player, missing);
    return true;
  }

  moveToFinalMirrorRoom(player);
  return true;
}

export function handleFinalMirrorRoomPortalUpdate(): void {
  ScriptApp.players.forEach(function (player) {
    try {
      handleFinalMirrorRoomPortal(player, player.getLocationName(), ScriptMap.name);
    } catch (_error) {
      // Some player states may not expose location data during map transitions.
    }
  });
}

export function registerFinalMirrorRoomPortalLocations(): void {
  FINAL_MIRROR_ROOM_TRIGGER_ALIASES.forEach(function (locationName) {
    registerFinalMirrorRoomPortalTiles(locationName);

    if (registeredFinalMirrorRoomLocationNames.has(locationName)) {
      return;
    }

    registeredFinalMirrorRoomLocationNames.add(locationName);
    ScriptApp.addOnLocationEnter(locationName, function (player: ScriptPlayer) {
      handleFinalMirrorRoomPortal(player, locationName, ScriptMap.name);
    });
    ScriptApp.addOnLocationTouched(locationName, function (player: ScriptPlayer) {
      handleFinalMirrorRoomPortal(player, locationName, ScriptMap.name);
    });
  });
}

export function handlePortalGateObjectTouched(
  player: ScriptPlayer,
  key: string,
  mapName: string
): void {
  const parsed = parseGateBlockKey(key);
  if (!parsed) {
    return;
  }

  const entry = findPortalEntry(mapName, parsed.portalX, parsed.portalY);
  if (!entry) {
    return;
  }

  const missing = getMissingRequiredItems(player, entry.requiredItems);
  if (missing.length > 0) {
    showGateMissingMessage(player, missing, entry.missingMessage);
    placeGateBlocks(player, entry);
    return;
  }

  removeGateBlocks(player, entry);
}
