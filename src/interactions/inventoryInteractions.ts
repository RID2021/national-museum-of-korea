import type { ScriptPlayer } from "zep-script";

import { applyInventoryInteraction } from "../inventory";
import { inventoryInteractionMap } from "../inventory/constants";
import { findNearbyLocationName } from "../utils/location";

export const INVENTORY_INTERACTION_PREFIX = "inv:";
const INVENTORY_INTERACTION_PREFIX_ALIASES = [
  INVENTORY_INTERACTION_PREFIX,
  "nv:",
] as const;
const registeredInventoryLocationNames = new Set<string>();

function normalizeInteractionId(raw: string): string | null {
  const normalized = raw.trim();
  return normalized ? normalized : null;
}

function parseInteractionIdFromKey(key: string): string | null {
  if (typeof key !== "string") {
    return null;
  }

  const normalizedKey = key.trim();
  if (!normalizedKey) {
    return null;
  }

  for (const prefix of INVENTORY_INTERACTION_PREFIX_ALIASES) {
    if (!normalizedKey.startsWith(prefix)) {
      continue;
    }

    const remainder = normalizedKey.slice(prefix.length);
    const [id] = remainder.split("|");
    return normalizeInteractionId(id ?? "");
  }

  const [rawId] = normalizedKey.split("|");
  const normalizedId = normalizeInteractionId(rawId ?? "");
  if (!normalizedId) {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(inventoryInteractionMap, normalizedId)) {
    return normalizedId;
  }

  return null;
}

function getLocationNamesForInteractionId(interactionId: string): string[] {
  return INVENTORY_INTERACTION_PREFIX_ALIASES.map(function (prefix) {
    return `${prefix}${interactionId}`;
  });
}

export function registerInventoryInteractionLocations(): void {
  const ids = Object.keys(inventoryInteractionMap);
  ids.forEach(function (interactionId) {
    const id = normalizeInteractionId(interactionId);
    if (!id) {
      return;
    }

    getLocationNamesForInteractionId(id).forEach(function (locationName) {
      if (registeredInventoryLocationNames.has(locationName)) {
        return;
      }

      registeredInventoryLocationNames.add(locationName);
      ScriptApp.addOnLocationEnter(locationName, function (player: ScriptPlayer) {
        applyInventoryInteraction(id, player);
      });
      ScriptApp.addOnLocationTouched(locationName, function (player: ScriptPlayer) {
        applyInventoryInteraction(id, player);
      });
    });
  });
}

export function handleNearbyInventoryInteractionLocation(
  player: ScriptPlayer,
  radius = 1
): boolean {
  const locationName = findNearbyLocationName(
    player,
    registeredInventoryLocationNames,
    radius
  );
  if (!locationName) {
    return false;
  }

  return handleInventoryInteractionObjectKey(player, locationName);
}

export function handleInventoryInteractionObjectKey(
  player: ScriptPlayer,
  key: string
): boolean {
  const interactionId = parseInteractionIdFromKey(key);
  if (!interactionId) {
    return false;
  }

  applyInventoryInteraction(interactionId, player);
  return true;
}
