import type { ScriptPlayer } from "zep-script";

import { debugMessage } from "./message";

export type PlayerTagRecord = Record<string, unknown>;
export type PlayerStorageRecord = Record<string, unknown>;

export function preparePlayerTag(player: ScriptPlayer): PlayerTagRecord {
  if (!player.tag || typeof player.tag !== "object") {
    player.tag = {};
  }
  player.sendUpdated();
  return player.tag as PlayerTagRecord;
}

export function preparePlayerStorage<T extends PlayerStorageRecord>(
  player: ScriptPlayer,
  defaults?: T,
): PlayerStorageRecord & T {
  let parsed: PlayerStorageRecord = {};

  if (player.storage) {
    try {
      parsed = JSON.parse(player.storage) as PlayerStorageRecord;
    } catch (_error) {
      debugMessage({ type: "player:storage:parse-error", playerId: player.id });
      parsed = {};
    }
  }

  const merged = defaults ? { ...defaults, ...parsed } : parsed;
  player.storage = JSON.stringify(merged);
  player.save();
  return merged as PlayerStorageRecord & T;
}

export function loadPlayerStorage<T extends PlayerStorageRecord = PlayerStorageRecord>(
  player: ScriptPlayer,
  defaults?: T,
): PlayerStorageRecord & T {
  if (!player.storage) {
    return (defaults ?? {}) as PlayerStorageRecord & T;
  }

  try {
    const parsed = JSON.parse(player.storage) as PlayerStorageRecord;
    return {
      ...(defaults ?? {}),
      ...parsed,
    } as PlayerStorageRecord & T;
  } catch (_error) {
    debugMessage({ type: "player:storage:parse-error", playerId: player.id });
    return (defaults ?? {}) as PlayerStorageRecord & T;
  }
}

interface SaveOptions {
  persist?: boolean;
}

export function savePlayerStorage(
  player: ScriptPlayer,
  storage: PlayerStorageRecord,
  options?: SaveOptions,
): void {
  player.storage = JSON.stringify(storage);

  if (options?.persist && typeof player.save === "function") {
    try {
      player.save();
    } catch (_error) {
      debugMessage({ type: "player:storage:save-error", playerId: player.id });
    }
  }
}
