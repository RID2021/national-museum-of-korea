import { ObjectEffectType } from "zep-script";
import { debugMessage } from "../utils/message";
import { loadPlayerStorage, savePlayerStorage } from "../utils/player";
import {
  FIX_GAME_STORAGE_KEY,
  FIX_GATE_KEY_PREFIX,
  FIX_GATE_TILE,
  FIX_TARGETS,
  FIX_TARGET_COUNT,
  FIX_GAME_MAP_NAME,
  brokenSprite,
  fixedSprite,
  transparentGateSprite,
} from "./constants";
import type {
  FixGamePlayerStorage,
  FixGameStorage,
  FixTarget,
  ScriptPlayer,
} from "./types";

type GatePlacement = {
  key: string;
  x: number;
  y: number;
  impassable: boolean;
  resource: any;
};

const GATE_NEIGHBOR_OFFSETS: Array<{ dx: number; dy: number }> = [
  { dx: -1, dy: -1 },
  { dx: 0, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
  { dx: -1, dy: 1 },
  { dx: 0, dy: 1 },
  { dx: 1, dy: 1 },
];

const GATE_BUFFER_OFFSETS: Array<{ dx: number; dy: number }> = [];

for (let dx = -2; dx <= 2; dx += 1) {
  for (let dy = -2; dy <= 2; dy += 1) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) === 2) {
      GATE_BUFFER_OFFSETS.push({ dx, dy });
    }
  }
}

function isFixGameComplete(fixGame: FixGameStorage): boolean {
  return fixGame.fixedKeys.length >= FIX_TARGET_COUNT;
}

function buildGatePlacements(): GatePlacement[] {
  const impassableRing = GATE_NEIGHBOR_OFFSETS.map(function (entry) {
    const x = FIX_GATE_TILE.x + entry.dx;
    const y = FIX_GATE_TILE.y + entry.dy;

    return {
      key: `${FIX_GATE_KEY_PREFIX}-wall-${x}-${y}`,
      x,
      y,
      impassable: true,
      resource: brokenSprite,
    };
  });

  const passableRing = GATE_BUFFER_OFFSETS.map(function (entry) {
    const x = FIX_GATE_TILE.x + entry.dx;
    const y = FIX_GATE_TILE.y + entry.dy;

    return {
      key: `${FIX_GATE_KEY_PREFIX}-buffer-${x}-${y}`,
      x,
      y,
      impassable: false,
      resource: transparentGateSprite,
    };
  });

  return [...impassableRing, ...passableRing];
}

function normalizeFixGameStorage(
  current: FixGameStorage | undefined
): FixGameStorage {
  const keysWereArray = Array.isArray(current?.fixedKeys);
  const parsedKeys = keysWereArray
    ? current.fixedKeys.filter(
        (value): value is string => typeof value === "string"
      )
    : [];
  const uniqueKeys = Array.from(new Set(parsedKeys));

  const gateKeysWereArray = Array.isArray(current?.gateObjectKeys);
  const parsedGateKeys = gateKeysWereArray
    ? current.gateObjectKeys.filter(
        (value): value is string => typeof value === "string"
      )
    : [];
  const uniqueGateKeys = Array.from(new Set(parsedGateKeys));

  return {
    fixedKeys: uniqueKeys,
    gateObjectKeys: uniqueGateKeys,
  };
}

function ensureFixGameStorage(player: ScriptPlayer): {
  storage: FixGamePlayerStorage;
  fixGame: FixGameStorage;
} {
  const storage = loadPlayerStorage<FixGamePlayerStorage>(player, {
    [FIX_GAME_STORAGE_KEY]: { fixedKeys: [], gateObjectKeys: [] },
  });
  const current = storage[FIX_GAME_STORAGE_KEY];
  const fixGame = normalizeFixGameStorage(current);

  const needsPersist =
    !current ||
    !Array.isArray(current.fixedKeys) ||
    !Array.isArray(current.gateObjectKeys) ||
    fixGame.fixedKeys.length !== (current?.fixedKeys?.length ?? 0) ||
    fixGame.gateObjectKeys.length !== (current?.gateObjectKeys?.length ?? 0);
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
  const isFixed = fixedKeys.includes(target.key);
  const resource = isFixed ? fixedSprite : brokenSprite;

  player.putIndividualObject(target.x, target.y, resource, {
    type: ObjectEffectType.INTERACTION_WITH_ZEPSCRIPTS,
    key: target.key,
    overlap: true,
    impassable: true,
  });
}

function placeGateBlocks(
  player: ScriptPlayer,
  storage: FixGamePlayerStorage,
  fixGame: FixGameStorage
): FixGameStorage {
  const placements = buildGatePlacements();
  placements.forEach(function (placement) {
    player.putIndividualObject(placement.x, placement.y, transparentGateSprite, {
      type: ObjectEffectType.NONE,
      key: placement.key,
      overlap: true,
      impassable: placement.impassable,
    });
  });

  const gateObjectKeys = Array.from(
    new Set([
      ...fixGame.gateObjectKeys,
      ...placements.map((entry) => entry.key),
    ])
  );
  const updated: FixGameStorage = {
    ...fixGame,
    gateObjectKeys,
  };
  storage[FIX_GAME_STORAGE_KEY] = updated;

  if (gateObjectKeys.length !== fixGame.gateObjectKeys.length) {
    savePlayerStorage(player, storage, { persist: true });
  }

  return updated;
}

function removeGateBlocks(
  player: ScriptPlayer,
  storage: FixGamePlayerStorage,
  fixGame: FixGameStorage
): FixGameStorage {
  if (!fixGame.gateObjectKeys.length) {
    return fixGame;
  }

  const playerDisappearObject = (player as any).disappearObject;

  if (typeof playerDisappearObject !== "function") {
    debugMessage({
      type: "fix-game:missing-disappearObject",
      playerId: player.id,
    });
  } else {
    fixGame.gateObjectKeys.forEach(function (gateKey) {
      playerDisappearObject.call(player, gateKey);
    });
  }

  const updated: FixGameStorage = {
    ...fixGame,
    gateObjectKeys: [],
  };
  storage[FIX_GAME_STORAGE_KEY] = updated;
  savePlayerStorage(player, storage, { persist: true });

  return updated;
}

function isGateObjectKey(key: string, fixGame: FixGameStorage): boolean {
  return (
    key.startsWith(FIX_GATE_KEY_PREFIX) || fixGame.gateObjectKeys.includes(key)
  );
}

function showIncompleteMessage(player: ScriptPlayer, fixedCount: number): void {
  const text = `수리가 완료되지 않았음 ${fixedCount}/${FIX_TARGET_COUNT}`;

  if (typeof (player as any).showCenterLabel === "function") {
    (player as any).showCenterLabel(text);
    return;
  }

  if (typeof player.sendMessage === "function") {
    player.sendMessage(text);
  }
}

export function handleFixGameJoin(
  player: ScriptPlayer,
  _mapName: string
): void {
  const { storage, fixGame } = ensureFixGameStorage(player);
  FIX_TARGETS.forEach(function (target) {
    placeTargetForPlayer(player, target, fixGame.fixedKeys);
  });

  if (isFixGameComplete(fixGame)) {
    if (fixGame.gateObjectKeys.length > 0) {
      removeGateBlocks(player, storage, fixGame);
    }
    return;
  }

  placeGateBlocks(player, storage, fixGame);
}

export function handleFixGameObjectInteraction(
  player: ScriptPlayer,
  key: string,
  _mapName: string,
  isInteraction?: boolean
): void {
  const { storage, fixGame } = ensureFixGameStorage(player);

  if (isGateObjectKey(key, fixGame)) {
    if (isFixGameComplete(fixGame)) {
      removeGateBlocks(player, storage, fixGame);
      return;
    }

    placeGateBlocks(player, storage, fixGame);
    showIncompleteMessage(player, fixGame.fixedKeys.length);
    return;
  }

  const target = FIX_TARGETS.find(function (entry) {
    return entry.key === key;
  });

  if (!target) {
    return;
  }

  if (!isInteraction) {
    return;
  }

  if (fixGame.fixedKeys.includes(key)) {
    return;
  }

  player.putIndividualObject(target.x, target.y, fixedSprite, {
    type: ObjectEffectType.INTERACTION_WITH_ZEPSCRIPTS,
    key,
    impassable: true,
    overlap: true,
  });

  const updatedKeys = [...fixGame.fixedKeys, key];
  const updatedFixGame: FixGameStorage = {
    ...fixGame,
    fixedKeys: updatedKeys,
  };
  storage[FIX_GAME_STORAGE_KEY] = updatedFixGame;
  savePlayerStorage(player, storage, { persist: true });

  if (isFixGameComplete(updatedFixGame)) {
    removeGateBlocks(player, storage, updatedFixGame);
  }
}

export function resetFixGameProgress(
  player: ScriptPlayer,
  mapName: string
): void {
  if (mapName !== FIX_GAME_MAP_NAME) {
    return;
  }

  const { storage, fixGame } = ensureFixGameStorage(player);
  removeGateBlocks(player, storage, fixGame);
  const resetState: FixGameStorage = { fixedKeys: [], gateObjectKeys: [] };

  storage[FIX_GAME_STORAGE_KEY] = resetState;
  savePlayerStorage(player, storage, { persist: true });

  FIX_TARGETS.forEach(function (target) {
    placeTargetForPlayer(player, target, resetState.fixedKeys);
  });

  placeGateBlocks(player, storage, resetState);
}
