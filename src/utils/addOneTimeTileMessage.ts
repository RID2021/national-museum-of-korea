import { type ScriptPlayer } from "zep-script";

import {
  PlayerStorageRecord,
  loadPlayerStorage,
  savePlayerStorage,
} from "./player";
import { tileMessageMap, type MapTileMessageEntry } from "../tileMessages";

type TileMessageStorage = PlayerStorageRecord & {
  tileMessages?: Record<string, boolean>;
};

export interface TileMessageOptions {
  persist?: boolean;
}

export type TileMessageMap = Record<string, string>;
export type MapTileMessageConfig = Record<string, MapTileMessageEntry>;

function ensureTileMessageMap(
  storage: TileMessageStorage
): Record<string, boolean> {
  if (storage.tileMessages && typeof storage.tileMessages === "object") {
    return storage.tileMessages as Record<string, boolean>;
  }

  storage.tileMessages = {};
  return storage.tileMessages;
}

export function addOneTimeTileMessage(
  tileName: string,
  key: string,
  message: string,
  options?: TileMessageOptions
): void {
  const trimmedKey = key.trim();
  const trimmedMessage = message.trim();
  if (!tileName || !trimmedKey || !trimmedMessage) {
    return;
  }

  ScriptApp.addOnLocationEnter(tileName, function (player: ScriptPlayer) {
    const storage = loadPlayerStorage<TileMessageStorage>(player, {
      tileMessages: {},
    });
    const tileMessages = ensureTileMessageMap(storage);

    if (tileMessages[trimmedKey]) {
      return;
    }

    tileMessages[trimmedKey] = true;
    savePlayerStorage(player, storage, { persist: options?.persist !== false });
    player.showCenterLabel(trimmedMessage, 0xffffff, 0x000000, 400, 5000);
  });
}

function resolveMapTileMessage(
  mapName: string,
  config: MapTileMessageConfig
):
  | {
      key: string;
      message: string;
    }
  | undefined {
  const entry = config[mapName];
  if (!entry || typeof entry.message !== "string") {
    return undefined;
  }

  const message = entry.message.trim();
  const key = (entry.key ?? mapName).trim();

  if (!message || !key) {
    return undefined;
  }

  return { key, message };
}

export function registerMapMessageTile(
  config: MapTileMessageConfig,
  options?: TileMessageOptions
): void {
  ScriptApp.addOnLocationEnter("message", function (player: ScriptPlayer) {
    const resolved = resolveMapTileMessage(ScriptMap.name, config);
    if (!resolved) {
      return;
    }

    const { key, message } = resolved;
    const storage = loadPlayerStorage<TileMessageStorage>(player, {
      tileMessages: {},
    });
    const tileMessages = ensureTileMessageMap(storage);
    const storageKey = `map:${key}`;

    if (tileMessages[storageKey]) {
      return;
    }

    tileMessages[storageKey] = true;
    savePlayerStorage(player, storage, { persist: options?.persist !== false });
    player.showCenterLabel(message, 0xffffff, 0x000000, 400, 5000);  });
}

export function registerConfiguredTileMessages(
  options?: TileMessageOptions
): void {
  registerMapMessageTile(tileMessageMap, options);
}

export function resetTileMessageHistory(
  player: ScriptPlayer,
  options?: TileMessageOptions
): void {
  const storage = loadPlayerStorage<TileMessageStorage>(player, {
    tileMessages: {},
  });
  storage.tileMessages = {};
  savePlayerStorage(player, storage, { persist: options?.persist !== false });
}
