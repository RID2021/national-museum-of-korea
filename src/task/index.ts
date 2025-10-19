import type { ScriptPlayer, ScriptWidget } from "zep-script";

import { debugMessage } from "../utils/message";
import {
  loadPlayerStorage,
  PlayerTagRecord,
  preparePlayerTag,
  savePlayerStorage,
} from "../utils/player";
import { DEFAULT_TASK, taskMap } from "./constants";
const TASK_WIDGET_TEMPLATE = "html/task-widget.html";

const TASK_WIDGET_DIMENSIONS = Object.freeze({
  desktop: { width: 250, height: 180 },
  mobile: { width: 250, height: 180 },
});

type TaskPlayerTag = PlayerTagRecord & {
  taskWidget?: ScriptWidget | null;
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

function resolveImageUrl(mapName: string): string | undefined {
  const entry = (taskMap as Record<string, string | undefined>)[mapName];
  if (typeof entry !== "string" || !entry.trim()) {
    return DEFAULT_TASK;
  }

  return entry;
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

  if (existing && typeof existing.destroy === "function") {
    existing.destroy();
  }
}

export function toggleTaskWidget(
  mapName: string,
  player: ScriptPlayer
): ScriptWidget | null {
  const imageUrl = resolveImageUrl(mapName);
  debugMessage(imageUrl);
  const tag = preparePlayerTag(player) as TaskPlayerTag;
  if (!imageUrl) {
    debugMessage({ type: "task:image:not-found", mapName });
    teardownTaskWidget(tag);
    return null;
  }
  if (tag.taskWidget) {
    teardownTaskWidget(tag);
    return;
  }
  return loadTaskWidget(mapName, player);
}

export function loadTaskWidget(
  mapName: string,
  player: ScriptPlayer
): ScriptWidget | null {
  const imageUrl = resolveImageUrl(mapName);
  debugMessage(imageUrl);
  const tag = preparePlayerTag(player) as TaskPlayerTag;
  if (!imageUrl) {
    return null;
  }
  const storage = loadPlayerStorage(player);
  if (tag.taskWidget) {
    if (storage.lastWidgetMapName === mapName) {
      return tag.taskWidget;
    }
    teardownTaskWidget(tag); // 내리고 다시 실행
  }
  const { width, height } = pickWidgetDimensions(player);
  const widget = player.showWidget(
    TASK_WIDGET_TEMPLATE,
    player.isMobile ? "top" : "bottomright",
    width,
    height
  );

  tag.taskWidget = widget;
  savePlayerStorage(player, {
    ...storage,
    lastWidgetMapName: mapName,
  });

  widget.onMessage.Add(function (_sender, data) {
    const type = (data as TaskWidgetIncomingMessage | undefined)?.type;

    if (type === "task:close") {
      teardownTaskWidget(tag);
      return;
    }

    if (type === "task:ready") {
      sendImageToWidget(widget, mapName, imageUrl);
    }
  });

  sendImageToWidget(widget, mapName, imageUrl);
  return widget;
}

export function loadLastWidget(player: ScriptPlayer): ScriptWidget | null {
  const tag = preparePlayerTag(player) as TaskPlayerTag;
  debugMessage(tag);

  const storage = loadPlayerStorage(player);
  if (!storage.lastWidgetMapName) {
    return null;
  }
  const imageUrl = resolveImageUrl(storage.lastWidgetMapName as string);
  debugMessage(imageUrl);
  if (!imageUrl) {
    return null;
  }
  if (tag.taskWidget) {
    teardownTaskWidget(tag); // 내리고 다시 실행
  }
  const { width, height } = pickWidgetDimensions(player);
  const widget = player.showWidget(
    TASK_WIDGET_TEMPLATE,
    player.isMobile ? "top" : "bottomright",
    width,
    height
  );

  tag.taskWidget = widget;

  widget.onMessage.Add(function (_sender, data) {
    const type = (data as TaskWidgetIncomingMessage | undefined)?.type;

    if (type === "task:close") {
      teardownTaskWidget(tag);
      return;
    }

    if (type === "task:ready") {
      sendImageToWidget(widget, tag.lastWidgetMapName as string, imageUrl);
    }
  });

  sendImageToWidget(widget, tag.lastWidgetMapName as string, imageUrl);
  return widget;
}
