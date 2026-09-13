/**
 * Copyright (c) 2022 ZEP Co., LTD
 */

import "zep-script";
import { handleMuseumDiagnosticCommand, runMuseumDiagnosticPhase, traceMuseumObject } from "./src/nationalMuseum/diagnostics";
import { getEditorInteractionValue } from "./src/nationalMuseum/editorInteraction";
import { handleMuseumMissionCompletion } from "./src/nationalMuseum/navigation";
import { startMuseumExperience, leaveMuseumExperience } from "./src/nationalMuseum/gameplay";

import { KeyCodeType, ObjectEffectType, ScriptPlayer } from "zep-script";
import type { ScriptWidget } from "zep-script";

import {
  addInventoryItem,
  addInventoryItemByMapName,
  addInventoryItemByEarnItemName,
  clearInventoryItems,
  DEFAULT_INVENTORY_SIZE,
  ensureInventory,
  getInventory,
  showInventoryWidget,
} from "./src/inventory";
import {
  handleInventoryInteractionObjectKey,
  handleNearbyInventoryInteractionLocation,
  registerInventoryInteractionLocations,
} from "./src/interactions";
import {
  handleFinalMirrorRoomPortal,
  handleFinalMirrorRoomPortalUpdate,
  handlePortalGateJoin,
  handlePortalGateObjectTouched,
  registerFinalMirrorRoomPortalLocations,
} from "./src/portal";
import { handleSlideshowObjectKey } from "./src/slideshow";
import { loadLastWidget, loadTaskWidget, toggleTaskWidget } from "./src/task";
import { destroyMinimapSystem } from "./src/minimap";
import { debugMessage } from "./src/utils/message";
import { registerConfiguredTileMessages, resetTileMessageHistory } from "./src/utils";
import { preparePlayerStorage, preparePlayerTag } from "./src/utils/player";
import { cameraMoveByMapName } from "./src/utils/camera";
import { setFinalTitle } from "./src/josun";
import {
  handleDestroy,
  handleHorseTouched,
  handlePlayerJoin,
  handlePlayerLeave,
  handleUpdate,
  startHorseGame,
} from "./src/game";
import {
  handleFixGameJoin,
  handleFixGameObjectInteraction,
  resetFixGameProgress,
} from "./src/fixGame";
import { FIX_GAME_MAP_NAME } from "./src/fixGame/constants";
import { ADD_ITEM_TILE_NAME, REFRESH_TASK_TILE_NAME } from "./src/constants";
import {
  handleNearbyMissionProgressLocation,
  handleMissionProgressObjectKey,
  registerMissionProgressLocations,
  resetMissionProgress,
  showMissionProgress,
} from "./src/missionProgress";
import {
  handleNearbyMissionQuizLocation,
  handleMissionQuizObjectKey,
  registerMissionQuizLocations,
} from "./src/missionQuiz";
import {
  handleNearbyMissionNpcLocation,
  handleMissionNpcObjectKey,
  registerMissionNpcLocations,
  requestMissionNpcAdvance,
  resetMissionNpcOncePerPlayerScenes,
} from "./src/missionNpc";
import {
  addMissionGameCompleteHandler,
  handleNearbyMissionGameLocation,
  handleMissionGameObjectKey,
  registerMissionGameLocations,
} from "./src/missionGame";
import {
  handleAnakMuralGateJoin,
  handleAnakMuralGateObjectKey,
  handleAnakMuralGateUpdate,
  registerAnakMuralGateTiles,
  syncAnakMuralGate,
} from "./src/anakMuralGate";
import {
  handleMuyongchongGateJoin,
  handleMuyongchongGateObjectKey,
  handleMuyongchongGateUpdate,
  registerMuyongchongGateTiles,
  syncMuyongchongGate,
} from "./src/muyongchongGate";
import {
  handleMuryeongTombGateJoin,
  handleMuryeongTombGateObjectKey,
  handleMuryeongTombGateUpdate,
  registerMuryeongTombGateTiles,
  syncMuryeongTombGate,
} from "./src/muryeongTombGate";
import {
  handleCheonmachongGateJoin,
  handleCheonmachongGateObjectKey,
  handleCheonmachongGateUpdate,
  registerCheonmachongGateTiles,
  syncCheonmachongGate,
} from "./src/cheonmachongGate";
import {
  handleDaeseongdongGateJoin,
  handleDaeseongdongGateObjectKey,
  handleDaeseongdongGateUpdate,
  registerDaeseongdongGateTiles,
  syncDaeseongdongGate,
} from "./src/daeseongdongGate";

const RECENT_INTERACTION_TTL_MS = 5000;
const NEARBY_INTERACTION_RADIUS = 1;

type RecentInteractionTag = Record<string, unknown> & {
  recentInteractionAt?: number;
  recentInteractionKeys?: string[];
};

type ButtonGroupPlayerTag = Record<string, unknown> & {
  buttonGroupWidget?: ScriptWidget | null;
};

interface InteractionOptions {
  isObjectInteraction?: boolean;
  remember?: boolean;
}

function normalizeInteractionKey(key: unknown): string | null {
  if (typeof key !== "string") {
    return null;
  }

  const normalized = key.trim();
  return normalized ? normalized : null;
}

function rememberInteractionKey(player: ScriptPlayer, key: unknown): void {
  const normalized = normalizeInteractionKey(key);
  if (!normalized) {
    return;
  }

  const tag = preparePlayerTag(player) as RecentInteractionTag;
  const previousKeys = Array.isArray(tag.recentInteractionKeys)
    ? tag.recentInteractionKeys
    : [];
  tag.recentInteractionKeys = [
    normalized,
    ...previousKeys.filter(function (candidate) {
      return candidate !== normalized;
    }),
  ].slice(0, 6);
  tag.recentInteractionAt = Date.now();
}

function handleInteractionKey(
  player: ScriptPlayer,
  key: unknown,
  options?: InteractionOptions
): boolean {
  const normalized = normalizeInteractionKey(key);
  if (!normalized) {
    return false;
  }

  let handled = false;
  handled = handleSlideshowObjectKey(player, normalized) || handled;
  handled =
    handleFinalMirrorRoomPortal(player, normalized, ScriptMap.name) || handled;
  handled =
    handleMissionProgressObjectKey(player, normalized, ScriptMap.name) ||
    handled;
  handled = handleMissionQuizObjectKey(player, normalized) || handled;
  handled = handleMissionNpcObjectKey(player, normalized) || handled;
  handled = handleMissionGameObjectKey(player, normalized) || handled;
  handled =
    handleAnakMuralGateObjectKey(player, normalized, ScriptMap.name) ||
    handled;
  handled =
    handleMuyongchongGateObjectKey(player, normalized, ScriptMap.name) ||
    handled;
  handled =
    handleMuryeongTombGateObjectKey(player, normalized, ScriptMap.name) ||
    handled;
  handled =
    handleCheonmachongGateObjectKey(player, normalized, ScriptMap.name) ||
    handled;
  handled =
    handleDaeseongdongGateObjectKey(player, normalized, ScriptMap.name) ||
    handled;
  handled = handleInventoryInteractionObjectKey(player, normalized) || handled;

  handlePortalGateObjectTouched(player, normalized, ScriptMap.name);
  syncAnakMuralGate(player, ScriptMap.name);
  syncMuyongchongGate(player, ScriptMap.name);
  syncMuryeongTombGate(player, ScriptMap.name);
  syncCheonmachongGate(player, ScriptMap.name);
  syncDaeseongdongGate(player, ScriptMap.name);

  if (ScriptMap.name === FIX_GAME_MAP_NAME) {
    handleFixGameObjectInteraction(
      player,
      normalized,
      ScriptMap.name,
      Boolean(options?.isObjectInteraction)
    );
  }

  if (handled && options?.remember !== false) {
    rememberInteractionKey(player, normalized);
  }

  return handled;
}

function getObjectByInteractionKey(
  key: string
): { param1?: string; key?: string } | null {
  try {
    return ScriptMap.getObjectWithKey(key) as
      | { param1?: string; key?: string }
      | null;
  } catch (_error) {
    return null;
  }
}

function handleInteractionKeyOrObjectParam(
  player: ScriptPlayer,
  key: unknown,
  options?: InteractionOptions
): boolean {
  const normalized = normalizeInteractionKey(key);
  if (!normalized) {
    return false;
  }

  if (options?.remember !== false) {
    rememberInteractionKey(player, normalized);
  }

  const handledByKey = handleInteractionKey(player, normalized, {
    ...options,
    remember: false,
  });
  if (handledByKey) {
    return true;
  }

  const targetObject = getObjectByInteractionKey(normalized);
  if (!targetObject) {
    return false;
  }

  const handledByParam = handleInteractionKey(player, targetObject.param1, {
    ...options,
    remember: options?.remember,
  });
  if (handledByParam) {
    return true;
  }

  if (
    typeof targetObject.key === "string" &&
    targetObject.key.trim() &&
    targetObject.key !== normalized
  ) {
    return handleInteractionKey(player, targetObject.key, {
      ...options,
      remember: options?.remember,
    });
  }

  return false;
}

function handleRecentInteractionKey(player: ScriptPlayer): boolean {
  const tag = (player.tag ?? {}) as RecentInteractionTag;
  if (
    typeof tag.recentInteractionAt !== "number" ||
    Date.now() - tag.recentInteractionAt > RECENT_INTERACTION_TTL_MS ||
    !Array.isArray(tag.recentInteractionKeys)
  ) {
    return false;
  }

  return tag.recentInteractionKeys.some(function (key) {
    return handleInteractionKeyOrObjectParam(player, key, {
      isObjectInteraction: true,
      remember: false,
    });
  });
}

function handleNearbyInteractionLocation(player: ScriptPlayer): boolean {
  return (
    handleNearbyMissionNpcLocation(player, NEARBY_INTERACTION_RADIUS) ||
    handleNearbyMissionGameLocation(player, NEARBY_INTERACTION_RADIUS) ||
    handleNearbyMissionQuizLocation(player, NEARBY_INTERACTION_RADIUS) ||
    handleNearbyMissionProgressLocation(
      player,
      ScriptMap.name,
      NEARBY_INTERACTION_RADIUS
    ) ||
    handleNearbyInventoryInteractionLocation(player, NEARBY_INTERACTION_RADIUS)
  );
}

function handleCurrentInteractionLocation(player: ScriptPlayer): boolean {
  try {
    return handleInteractionKey(player, player.getLocationName(), {
      isObjectInteraction: true,
    });
  } catch (_error) {
    return false;
  }
}

function handleActionButton(player: ScriptPlayer): void {
  if (requestMissionNpcAdvance(player)) {
    return;
  }

  if (handleRecentInteractionKey(player)) {
    return;
  }

  if (handleCurrentInteractionLocation(player)) {
    return;
  }

  handleNearbyInteractionLocation(player);
}

ScriptApp.onInit.Add(() => runMuseumDiagnosticPhase("onInit", function () {
  // register task key
  ScriptApp.addOnKeyDown(KeyCodeType.T, function (player) {
    debugMessage("T: key Pressed");
    toggleTaskWidget(ScriptMap.name, player);
  });
  ScriptApp.addOnKeyDown(KeyCodeType.F, function (player) {
    handleActionButton(player);
  });
  ScriptApp.addOnKeyDown(32, function (player) {
    handleActionButton(player);
  });
  registerInventoryInteractionLocations();
  registerMissionProgressLocations();
  registerFinalMirrorRoomPortalLocations();
  registerMissionQuizLocations();
  registerMissionNpcLocations();
  registerMissionGameLocations();
  registerAnakMuralGateTiles();
  registerMuyongchongGateTiles();
  registerMuryeongTombGateTiles();
  registerCheonmachongGateTiles();
  registerDaeseongdongGateTiles();
  registerMissionGameCompletionNpcFeedback();

  registerConfiguredTileMessages();
}));



ScriptApp.onJoinPlayer.Add((player) => runMuseumDiagnosticPhase("onJoinPlayer", function () {
  loadPCButtonGroup(player);
  preparePlayerTag(player);
  preparePlayerStorage(player, {
    purchases: {},
    fixGame: { fixedKeys: [], gateObjectKeys: [] },
    missionProgress: { missions: {} },
  });
  resetTileMessageHistory(player);
  const mapName = ScriptMap.name;
  setFinalTitle(player, mapName);
  ensureInventory(player, DEFAULT_INVENTORY_SIZE);
  const inventory = getInventory(player);
  if (!inventory.items.some((item) => item.name === "테스트 열쇠")) {
    addInventoryItem(player, {
      name: "테스트 열쇠",
      imageUrl: "https://rid.gcdn.ntruss.com/countries/gold_A.png",
      description: "테스트 용으로 지급된 아이템입니다.",
      quantity: 1,
    });
  }
  if (mapName == "가평교육원") {
    checkPassport(player);
  }

  handlePortalGateJoin(player, mapName);
  handleAnakMuralGateJoin(player, mapName);
  handleMuyongchongGateJoin(player, mapName);
  handleMuryeongTombGateJoin(player, mapName);
  handleCheonmachongGateJoin(player, mapName);
  handleDaeseongdongGateJoin(player, mapName);

  cameraMoveByMapName(player, mapName);
  if (!player.isMobile) {
    loadLastWidget(mapName, player);
  }

  if (mapName === "피마길") {
    handlePlayerJoin(player);
  }

  if (mapName === FIX_GAME_MAP_NAME) {
    handleFixGameJoin(player, mapName);
  }
  startMuseumExperience(player, handleMissionNpcObjectKey);
}));

ScriptApp.addOnLocationEnter(REFRESH_TASK_TILE_NAME, function (player) {
  loadTaskWidget(ScriptMap.name, player, "after");
});

ScriptApp.addOnLocationEnter(ADD_ITEM_TILE_NAME, function (player) {
  debugMessage("아이템 추가 땅 밟음");
  addInventoryItemByEarnItemName(ScriptMap.name, player);
});

// ScriptApp.addOnTileTouched or addOnLocationTouched를 이용해서 특정 맵마다 location이름을 다르게 가져가야함, 그리고 해당 맵에서 trigger 될 주소 사전 세팅해두기.

ScriptApp.onStart.Add(function () {
});
ScriptApp.onStart.Add(startHorseGame);

ScriptApp.onAppObjectTouched.Add((player: ScriptPlayer, key: string) => {
  handleInteractionKeyOrObjectParam(player, key, { isObjectInteraction: false });
  // handleHorseTouched(player, key);
});

ScriptApp.onObjectTouched.Add(function (
  player: ScriptPlayer,
  x: number,
  y: number,
  tileID: number,
  obj: any
) {
  if (obj !== null) {
    const handledByParam = handleInteractionKey(player, obj.param1, {
      isObjectInteraction: false,
    });
    if (!handledByParam) {
      handleInteractionKeyOrObjectParam(player, obj.key, {
        isObjectInteraction: false,
      });
    }
  }
});



ScriptApp.onTriggerObject.Add(
  (player: ScriptPlayer, _layerId: number, _x: number, _y: number, key: string) => {
    traceMuseumObject(player, _layerId, _x, _y, key);
    const handled = handleInteractionKeyOrObjectParam(player, key, {
      isObjectInteraction: true,
    });
    if (!handled) {
      const value = getEditorInteractionValue(_layerId, _x, _y);
      if (value) handleInteractionKey(player, value, { isObjectInteraction: true });
    }
  },
);

ScriptApp.onLeavePlayer.Add((player: ScriptPlayer) => {
  leaveMuseumExperience(player);
  handlePlayerLeave(player);
});

ScriptApp.onUpdate.Add(function () {
  handleFinalMirrorRoomPortalUpdate();
  handleAnakMuralGateUpdate(ScriptMap.name);
  handleMuyongchongGateUpdate(ScriptMap.name);
  handleMuryeongTombGateUpdate(ScriptMap.name);
  handleCheonmachongGateUpdate(ScriptMap.name);
  handleDaeseongdongGateUpdate(ScriptMap.name);
});

// ScriptApp.onUpdate.Add((dt: number) => {
//   if (ScriptMap.name === "피마길" && ScriptApp.players.length > 0)
//     handleUpdate(dt);
// });

ScriptApp.onDestroy.Add(function () {
  destroyMinimapSystem();
  handleDestroy();
  ScriptMap.clearAllObjects();
});

function loadPCButtonGroup(player: ScriptPlayer) {
  const tag = preparePlayerTag(player) as ButtonGroupPlayerTag;

  if (tag.buttonGroupWidget) {
    tag.buttonGroupWidget.destroy();
    tag.buttonGroupWidget = null;
  }

  const widgetPath = player.isMobile
    ? "html/mobile_button-v7.html"
    : "html/pc_button-v2.html";
  const widgetAlign = player.isMobile ? "topright" : "topleft";
  const widgetWidth = 142;
  const widgetHeight = 72;

  const buttonGroup = player.showWidget(
    widgetPath,
    widgetAlign,
    widgetWidth,
    widgetHeight
  );
  tag.buttonGroupWidget = buttonGroup;

  buttonGroup.onMessage.Add(function (player: ScriptPlayer, message: any) {
    if (message.openTask) {
      toggleTaskWidget(ScriptMap.name, player);
    }
    if (message.openInventory) {
      showInventoryWidget(player, {
        template: "mobile",
        align: "middle",
        width: player.isMobile ? 214 : 270,
        height: player.isMobile ? 360 : 420,
      });
    }
    if (message.openMissionProgress) {
      showMissionProgress(player, ScriptMap.name);
    }
  });
}

function checkPassport(player: ScriptPlayer) {
  ensureInventory(player, DEFAULT_INVENTORY_SIZE);
  const inventory = getInventory(player);

  const passport = inventory.items.find((item) => item.name === "여권");
  if (passport) {
    player.spawnAt(49, 76);
  }
  else {
    player.spawnAt(42, 121)
  }
  return false;
}

function normalizeMissionNpcDebugTrigger(text: string): string | null {
  if (!text.startsWith("#npc ")) {
    return null;
  }

  const triggerInput = text.slice("#npc ".length).trim();
  if (!triggerInput) {
    return null;
  }

  return triggerInput.startsWith("npc:") || triggerInput.startsWith("dialog:")
    ? triggerInput
    : `npc:${triggerInput.replace(/\s+/g, ":")}`;
}

function normalizeMissionGameDebugTrigger(text: string): string | null {
  if (!text.startsWith("#game ")) {
    return null;
  }

  const triggerInput = text.slice("#game ".length).trim();
  if (!triggerInput) {
    return null;
  }

  return triggerInput.startsWith("game:") || triggerInput.startsWith("wg:")
    ? triggerInput
    : `game:${triggerInput.replace(/\s+/g, "-")}`;
}

function registerMissionGameCompletionNpcFeedback(): void {
  addMissionGameCompleteHandler(function (player, gameId) {
    if (handleMuseumMissionCompletion(player, gameId, handleMissionNpcObjectKey)) return;
    if (gameId === "muyongchong-hunting") {
      handleMissionNpcObjectKey(player, "npc:godu:hunting-success");
      syncMuyongchongGate(player, ScriptMap.name);
      return;
    }

    if (gameId === "muyongchong-dance") {
      handleMissionNpcObjectKey(player, "npc:godu:dance-success");
      syncMuyongchongGate(player, ScriptMap.name);
      return;
    }

    if (gameId === "jinmyosu-artifact-map") {
      handleMissionNpcObjectKey(player, "npc:jinmyosu:exchange-correct");
      syncMuryeongTombGate(player, ScriptMap.name);
      return;
    }

    if (gameId === "cheonmachong-costume") {
      handleMissionNpcObjectKey(player, "npc:seoki:costume-complete");
      syncCheonmachongGate(player, ScriptMap.name);
      return;
    }

    if (gameId === "daeseongdong-iron-process") {
      handleMissionNpcObjectKey(player, "npc:gwanghoek:iron-success");
      syncDaeseongdongGate(player, ScriptMap.name);
      return;
    }

    if (gameId === "daeseongdong-artifact-match") {
      handleMissionNpcObjectKey(player, "npc:gwanghoek:artifact-correct");
    }
  });
}

function resetOneTimeTriggerHistory(player: ScriptPlayer): void {
  resetMissionNpcOncePerPlayerScenes(player);
  resetTileMessageHistory(player);
  player.showCenterLabel(
    "1회 출력 트리거 기록을 초기화했습니다.",
    0xffffff,
    0x000000,
    420,
    3000
  );
  player.sendUpdated();
}

ScriptApp.onSay.Add((player: ScriptPlayer, text: string) => {
  if (handleMuseumDiagnosticCommand(player, text.trim())) return;
  if (player.role > 1000) {
    const trimmedText = text.trim();
    const debugNpcTrigger = normalizeMissionNpcDebugTrigger(text.trim());
    if (debugNpcTrigger) {
      handleMissionNpcObjectKey(player, debugNpcTrigger);
      syncAnakMuralGate(player, ScriptMap.name);
      syncMuyongchongGate(player, ScriptMap.name);
      syncCheonmachongGate(player, ScriptMap.name);
      syncMuryeongTombGate(player, ScriptMap.name);
      syncDaeseongdongGate(player, ScriptMap.name);
      return;
    }

    const debugGameTrigger = normalizeMissionGameDebugTrigger(text.trim());
    if (debugGameTrigger) {
      handleMissionGameObjectKey(player, debugGameTrigger);
      return;
    }

    if (text === "!인벤리셋") {
      clearInventoryItems(player);
      player.sendUpdated();
    } else if (text === "!게임리셋") {
      if (ScriptMap.name === FIX_GAME_MAP_NAME) {
        resetFixGameProgress(player, ScriptMap.name);
      }
    } else if (text === "!진행률") {
      showMissionProgress(player, ScriptMap.name);
    } else if (text === "!미션리셋") {
      resetMissionProgress(player);
      showMissionProgress(player, ScriptMap.name);
    } else if (trimmedText === "!트리거리셋") {
      resetOneTimeTriggerHistory(player);
    } else if (trimmedText === "!트리거리셋 전체") {
      ScriptApp.players.forEach(function (targetPlayer) {
        resetOneTimeTriggerHistory(targetPlayer);
      });
    } else if (text.startsWith("!npc ")) {
      const trigger = normalizeMissionNpcDebugTrigger(
        `#npc ${text.slice("!npc ".length).trim()}`
      );
      handleMissionNpcObjectKey(player, trigger);
      syncAnakMuralGate(player, ScriptMap.name);
      syncMuyongchongGate(player, ScriptMap.name);
      syncDaeseongdongGate(player, ScriptMap.name);
    } else if (text.startsWith("!game ")) {
      const trigger = normalizeMissionGameDebugTrigger(
        `#game ${text.slice("!game ".length).trim()}`
      );
      handleMissionGameObjectKey(player, trigger);
    } else if (text === "!상점") {
    }
  }
});
