import { ObjectEffectType, type ScriptPlayer } from "zep-script";

import { getInventory } from "../inventory";
import { debugMessage } from "../utils/message";
import { portalGateMap, type PortalGateEntry } from "./constants";

const PORTAL_GATE_KEY_PREFIX = "portal-gate";
const PORTAL_GATE_RADIUS = 2;

const portalGateSprite = ScriptApp.loadSpritesheet("images/transparent.png");

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

function buildGatePlacements(portalX: number, portalY: number, portalSize: number): GatePlacement[] {
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
  const entries = portalGateMap[mapName];
  if (!entries || !Array.isArray(entries)) {
    return null;
  }

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

function placeGateBlocks(player: ScriptPlayer, portalX: number, portalY: number, portalSize: number): void {
  const placements = buildGatePlacements(portalX, portalY, portalSize);
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

function removeGateBlocks(
  player: ScriptPlayer,
  portalX: number,
  portalY: number,
  portalSize: number
): void {
  const placements = buildGatePlacements(portalX, portalY, portalSize);
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
  const entries = portalGateMap[mapName];
  if (!entries || !Array.isArray(entries) || entries.length === 0) {
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

    placeGateBlocks(player, entry.portalX, entry.portalY, entry.portalSize);
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
    placeGateBlocks(player, entry.portalX, entry.portalY, entry.portalSize);
    return;
  }

  removeGateBlocks(player, entry.portalX, entry.portalY, entry.portalSize);
}
