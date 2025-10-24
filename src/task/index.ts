import type { ScriptPlayer, ScriptWidget } from "zep-script";

import { debugMessage } from "../utils/message";
import {
  loadPlayerStorage,
  PlayerTagRecord,
  preparePlayerTag,
  savePlayerStorage,
} from "../utils/player";
import { doubleTaskMap } from "./constants";
const TASK_WIDGET_TEMPLATE = "html/task-widget.html";

const TASK_WIDGET_DIMENSIONS = Object.freeze({
  desktop: { width: 250, height: 180 },
  mobile: { width: 208, height: 150 },
});

type TaskStage = "before" | "after";

type TaskPlayerTag = PlayerTagRecord & {
  taskWidget?: ScriptWidget | null;
  taskStage?: TaskStage;
  lastWidgetMapName?: string;
};

interface TaskWidgetIncomingMessage {
  type?: string;
}

interface TaskWidgetOutgoingMessage {
  type: "task:image";
  payload: {
    imageUrl: string;
    mapName: string;
  };
}

type TaskStorage = {
  lastWidgetMapName?: string;
  lastTaskStage?: TaskStage;
};

function resolveTaskImage(mapName: string, stage: TaskStage): string {
  const entry = doubleTaskMap[mapName as keyof typeof doubleTaskMap];
  const imageUrl = entry?.[stage];

  if (typeof imageUrl !== "string" || !imageUrl.trim()) {
    return "";
  }

  return imageUrl;
}

function pickWidgetDimensions(player: ScriptPlayer): {
  width: number;
  height: number;
} {
  return player.isMobile
    ? TASK_WIDGET_DIMENSIONS.mobile
    : TASK_WIDGET_DIMENSIONS.desktop;
}

function sendImageToWidget(
  widget: ScriptWidget | null | undefined,
  mapName: string,
  imageUrl: string
): void {
  if (!widget || typeof widget.sendMessage !== "function") {
    return;
  }

  const message: TaskWidgetOutgoingMessage = {
    type: "task:image",
    payload: { mapName, imageUrl },
  };

  widget.sendMessage(message);
}

function teardownTaskWidget(tag: TaskPlayerTag): void {
  const existing = tag.taskWidget;
  tag.taskWidget = null;
  tag.taskStage = undefined;
  tag.lastWidgetMapName = undefined;

  if (existing && typeof existing.destroy === "function") {
    existing.destroy();
  }
}

export function toggleTaskWidget(
  
  mapName: string,
  player: ScriptPlayer
): ScriptWidget | null {
  const tag = preparePlayerTag(player) as TaskPlayerTag;
  const storage = loadPlayerStorage(player) as TaskStorage;

  if (tag.taskWidget) {
    teardownTaskWidget(tag);
    return null;
  }

  const stage =
    storage.lastTaskStage ?? tag.taskStage ?? ("before" as TaskStage);
  debugMessage({ type: "task:toggle", mapName, stage });

  return loadTaskWidget(mapName, player, stage);
}

export function loadTaskWidget(
  mapName: string,
  player: ScriptPlayer,
  stage?: TaskStage
): ScriptWidget | null {
  const tag = preparePlayerTag(player) as TaskPlayerTag;
  const storage = loadPlayerStorage(player) as TaskStorage;
  const targetStage =
    stage ?? storage.lastTaskStage ?? tag.taskStage ?? ("before" as TaskStage);
  const imageUrl = resolveTaskImage(mapName, targetStage);
  debugMessage({ type: "task:load", mapName, stage: targetStage, imageUrl });

  if (tag.taskWidget) {
    tag.taskStage = targetStage;
    tag.lastWidgetMapName = mapName;
    savePlayerStorage(player, {
      ...storage,
      lastWidgetMapName: mapName,
      lastTaskStage: targetStage,
    });
    sendImageToWidget(tag.taskWidget, mapName, imageUrl);
    return tag.taskWidget;
  }

  const { width, height } = pickWidgetDimensions(player);
  const widget = player.showWidget(
    TASK_WIDGET_TEMPLATE,
    player.isMobile ? "top" : "bottomright",
    width,
    height
  );

  tag.taskWidget = widget;
  tag.taskStage = targetStage;
  tag.lastWidgetMapName = mapName;
  savePlayerStorage(player, {
    ...storage,
    lastWidgetMapName: mapName,
    lastTaskStage: targetStage,
  });

  widget.onMessage.Add(function (_sender, data) {
    const type = (data as TaskWidgetIncomingMessage | undefined)?.type;

    if (type === "task:close") {
      teardownTaskWidget(tag);
      return;
    }

    if (type === "task:ready") {
      const currentMapName = tag.lastWidgetMapName ?? mapName;
      const currentStage = tag.taskStage ?? targetStage;
      const currentImage = resolveTaskImage(currentMapName, currentStage);
      sendImageToWidget(widget, currentMapName, currentImage);
    }
  });

  sendImageToWidget(widget, mapName, imageUrl);
  return widget;
}

export function loadLastWidget(
  mapName: string,
  player: ScriptPlayer
): ScriptWidget | null {
  return loadTaskWidget(mapName, player, "before");
}
