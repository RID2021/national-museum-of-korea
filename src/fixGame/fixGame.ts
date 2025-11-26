import { ObjectEffectType } from "zep-script";
import { debugMessage } from "../utils/message";
import { loadPlayerStorage, savePlayerStorage } from "../utils/player";
import {
  FIX_GAME_STORAGE_KEY,
  FIX_TARGETS,
  brokenSprite,
  fixedSprite,
} from "./constants";
import type {
  FixGamePlayerStorage,
  FixGameStorage,
  FixTarget,
  ScriptPlayer,
} from "./types";

function getPutObjectWithKey(
  player: ScriptPlayer
): ((x: number, y: number, resource: any, option?: any) => void) | null {
  const playerPutObjectWithKey = (player as any).putObjectWithKey;

  if (typeof playerPutObjectWithKey === "function") {
    return playerPutObjectWithKey.bind(player);
  }

  debugMessage({
    type: "fix-game:missing-putObjectWithKey",
    playerId: player.id,
  });
  return null;
}

function ensureFixGameStorage(player: ScriptPlayer): {
  storage: FixGamePlayerStorage;
  fixGame: FixGameStorage;
} {
  const storage = loadPlayerStorage<FixGamePlayerStorage>(player, {
    [FIX_GAME_STORAGE_KEY]: { fixedKeys: [] },
  });
  const current = storage[FIX_GAME_STORAGE_KEY];

  const keysWereArray = Array.isArray(current?.fixedKeys);
  const parsedKeys = keysWereArray
    ? current.fixedKeys.filter(
        (value): value is string => typeof value === "string"
      )
    : [];
  const uniqueKeys = Array.from(new Set(parsedKeys));
  const needsPersist =
    !keysWereArray || uniqueKeys.length !== parsedKeys.length || !current;
  const fixGame: FixGameStorage = { fixedKeys: uniqueKeys };
  const nextStorage: FixGamePlayerStorage = {
    ...storage,
    [FIX_GAME_STORAGE_KEY]: fixGame,
  };

  if (needsPersist) {
    savePlayerStorage(player, nextStorage, { persist: true });
  }

  return { storage: nextStorage, fixGame };
}

function placeTargetForPlayer(
  player: ScriptPlayer,
  target: FixTarget,
  fixedKeys: string[]
): void {
  // const putObjectWithKey = getPutObjectWithKey(player);
  // if (!putObjectWithKey) {
  //   return;
  // }

  const isFixed = fixedKeys.includes(target.key);
  const resource = isFixed ? fixedSprite : brokenSprite;

  player.putIndividualObject(target.x, target.y, resource, {
    type: ObjectEffectType.INTERACTION_WITH_ZEPSCRIPTS,
    key: target.key,
    overlap: true,
    impassable: true,
  });
}

export function handleFixGameJoin(
  player: ScriptPlayer,
  _mapName: string
): void {
  const { fixGame } = ensureFixGameStorage(player);
  FIX_TARGETS.forEach(function (target) {
    placeTargetForPlayer(player, target, fixGame.fixedKeys);
  });
}

export function handleFixGameObjectInteraction(
  player: ScriptPlayer,
  key: string,
  _mapName: string
): void {
  const target = FIX_TARGETS.find(function (entry) {
    return entry.key === key;
  });

  if (!target) {
    return;
  }



  const { storage, fixGame } = ensureFixGameStorage(player);
  if (fixGame.fixedKeys.includes(key)) {
    return;
  }

  player.putIndividualObject(target.x, target.y, fixedSprite, {
    type: ObjectEffectType.INTERACTION_WITH_ZEPSCRIPTS,
    key,
    impassable:true,
    overlap: true,

  });

  const updatedKeys = [...fixGame.fixedKeys, key];
  storage[FIX_GAME_STORAGE_KEY] = { fixedKeys: updatedKeys };
  savePlayerStorage(player, storage, { persist: true });
}
