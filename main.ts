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
import { toggleTeleportShortcutWidget } from "./src/shortcut";
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

let shortcut_button_image = ScriptApp.loadSpritesheet("images/mission_button.png");
let shortcut_button;

let inventory_button_image = ScriptApp.loadSpritesheet(
  "images/inventory_button.png"
);
let inventory_button;

ScriptApp.onInit.Add(function () {
  // register inventory key
  ScriptApp.addOnKeyDown(KeyCodeType.I, function (player) {
    showInventoryWidget(player, {
      template: "mobile",
      align: player.isMobile ? "topleft" : "middleleft",
      width: player.isMobile ? 355 : 450,
      height: player.isMobile ? 600 : 700,
    });
  });

  // register task key
  ScriptApp.addOnKeyDown(KeyCodeType.T, function (player) {
    debugMessage("T: key Pressed");
    toggleTaskWidget(ScriptMap.name, player);
  });

  // register teleport shortcut key
  ScriptApp.addOnKeyDown(KeyCodeType.G, function (player) {
    toggleTeleportShortcutWidget(ScriptMap.name, player);
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
  shortcut_button = ScriptApp.addMobileButton(8, 125, 75, function (player) {
    toggleTeleportShortcutWidget(ScriptMap.name, player);
  });

  shortcut_button.image = shortcut_button_image;
  shortcut_button.sendUpdated();

  inventory_button = ScriptApp.addMobileButton(8, 50, 75, function (player) {
    debugMessage("mobile button clicked");
    showInventoryWidget(player, {
      template: "mobile",
      align: player.isMobile ? "topleft" : "middleleft",
      width: player.isMobile ? 355 : 450,
      height: player.isMobile ? 600 : 700,
    });
  });

  inventory_button.image = inventory_button_image;
  inventory_button.sendUpdated();
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
    if (obj.type == ObjectEffectType.INTERACTION_WITH_ZEPSCRIPTS) {
      handleInventoryInteractionObjectKey(player, obj.param1);
    }
  }
});



ScriptApp.onTriggerObject.Add(
  (player: ScriptPlayer, _layerId: number, _x: number, _y: number, key: string) => {
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
  handleDestroy();
  ScriptMap.clearAllObjects();
});

function loadPCButtonGroup(player: ScriptPlayer) {
  if (!player.isMobile) {
    const pcButtonGroup = player.showWidget(
      "html/pc_button.html",
      "topleft",
      250,
      150
    );
    pcButtonGroup.onMessage.Add(function (player: ScriptPlayer, message: any) {
      if (message.openTask) {
        toggleTaskWidget(ScriptMap.name, player);
      }
      if (message.openInventory) {
        showInventoryWidget(player, {
          template: "mobile",
          align: player.isMobile ? "topleft" : "middleleft",
          width: player.isMobile ? 355 : 450,
          height: player.isMobile ? 600 : 700,
        });
      }
      if (message.openShortcut) {
        toggleTeleportShortcutWidget(ScriptMap.name, player);
      }
    });
  }
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
