/**
 * Copyright (c) 2022 ZEP Co., LTD
 */

import "zep-script";

import { KeyCodeType, ObjectEffectType, ScriptPlayer } from "zep-script";

import {
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
  registerInventoryInteractionLocations,
} from "./src/interactions";
import {
  handlePortalGateJoin,
  handlePortalGateObjectTouched,
} from "./src/portal";
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

ScriptApp.onInit.Add(function () {
  // register task key
  ScriptApp.addOnKeyDown(KeyCodeType.T, function (player) {
    debugMessage("T: key Pressed");
    toggleTaskWidget(ScriptMap.name, player);
  });
  registerInventoryInteractionLocations();

  registerConfiguredTileMessages();
});



ScriptApp.onJoinPlayer.Add(function (player) {
  loadPCButtonGroup(player);
  preparePlayerTag(player);
  preparePlayerStorage(player, {
    purchases: {},
    fixGame: { fixedKeys: [], gateObjectKeys: [] },
  });
  resetTileMessageHistory(player);
  const mapName = ScriptMap.name;
  setFinalTitle(player, mapName);
  ensureInventory(player, DEFAULT_INVENTORY_SIZE);
  if (mapName == "가평교육원") {
    checkPassport(player);
  }

  handlePortalGateJoin(player, mapName);

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
});

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
  handlePortalGateObjectTouched(player, key, ScriptMap.name);

  if (ScriptMap.name === FIX_GAME_MAP_NAME) {
    handleFixGameObjectInteraction(player, key, ScriptMap.name, false);
  }
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
    const handledByParam = handleInventoryInteractionObjectKey(player, obj.param1);
    if (!handledByParam) {
      handleInventoryInteractionObjectKey(player, obj.key);
    }
  }
});



ScriptApp.onTriggerObject.Add(
  (player: ScriptPlayer, _layerId: number, _x: number, _y: number, key: string) => {
    const handledByKey = handleInventoryInteractionObjectKey(player, key);
    if (!handledByKey) {
      const targetObject = ScriptMap.getObjectWithKey(key) as
        | { param1?: string; key?: string }
        | null;

      if (targetObject) {
        const handledByParam = handleInventoryInteractionObjectKey(
          player,
          targetObject.param1 ?? ""
        );
        if (!handledByParam && typeof targetObject.key === "string") {
          handleInventoryInteractionObjectKey(player, targetObject.key);
        }
      }
    }

    if (ScriptMap.name === FIX_GAME_MAP_NAME) {
      handleFixGameObjectInteraction(player, key, ScriptMap.name, true);
    }
  },
);

ScriptApp.onLeavePlayer.Add((player: ScriptPlayer) => {
  handlePlayerLeave(player);
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
  const widgetPath = player.isMobile
    ? "html/mobile_button-v5.html"
    : "html/pc_button.html";
  const widgetAlign = player.isMobile ? "bottomright" : "topleft";
  const widgetWidth = player.isMobile ? 400 : 360;
  const widgetHeight = player.isMobile ? 190 : 150;

  const buttonGroup = player.showWidget(
    widgetPath,
    widgetAlign,
    widgetWidth,
    widgetHeight
  );

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

ScriptApp.onSay.Add((player: ScriptPlayer, text: string) => {
  if (player.role > 1000) {
    if (text === "!인벤리셋") {
      clearInventoryItems(player);
      player.sendUpdated();
    } else if (text === "!게임리셋") {
      if (ScriptMap.name === FIX_GAME_MAP_NAME) {
        resetFixGameProgress(player, ScriptMap.name);
      }
    } else if (text === "!상점") {
    }
  }
});
