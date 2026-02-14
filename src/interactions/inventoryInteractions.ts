import type { ScriptPlayer } from "zep-script";

import { applyInventoryInteraction } from "../inventory";
import { inventoryInteractionMap } from "../inventory/constants";

export const INVENTORY_INTERACTION_PREFIX = "inv:";

function normalizeInteractionId(raw: string): string | null {
  const normalized = raw.trim();
  return normalized ? normalized : null;
}

function parseInteractionIdFromKey(key: string): string | null {
  if (typeof key !== "string") {
    return null;
  }

  if (!key.startsWith(INVENTORY_INTERACTION_PREFIX)) {
    return null;
  }

  const remainder = key.slice(INVENTORY_INTERACTION_PREFIX.length);
  const [id] = remainder.split("|");
  return normalizeInteractionId(id ?? "");
}

function getLocationNamesForInteractionId(interactionId: string): string[] {
  return [`${INVENTORY_INTERACTION_PREFIX}${interactionId}`];
}

export function registerInventoryInteractionLocations(): void {
  const ids = Object.keys(inventoryInteractionMap);
  ids.forEach(function (interactionId) {
    const id = normalizeInteractionId(interactionId);
    if (!id) {
      return;
    }

    getLocationNamesForInteractionId(id).forEach(function (locationName) {
      ScriptApp.addOnLocationEnter(locationName, function (player: ScriptPlayer) {
        applyInventoryInteraction(id, player);
      });
    });
  });
}

export function handleInventoryInteractionObjectKey(
  player: ScriptPlayer,
  key: string
): void {
  const interactionId = parseInteractionIdFromKey(key);
  if (!interactionId) {
    return;
  }

  applyInventoryInteraction(interactionId, player);
}
