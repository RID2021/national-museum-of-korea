import type { ScriptPlayer, ScriptWidget } from "zep-script";

import minimapMapsRaw from "./minimapMaps.json";
import { preparePlayerTag, type PlayerTagRecord } from "../utils/player";

const MINIMAP_WIDGET_TEMPLATE = "html/minimap-widget.html";

const MINIMAP_WIDGET_DIMENSIONS = Object.freeze({
  desktop: { width: 430, height: 760 },
  mobile: { width: 340, height: 620 },
});

const MINIMAP_UPDATE_INTERVAL_MS = 250;
const DEFAULT_DOT_COLOR = "#ff8a3d";
const DEFAULT_ACCENT_COLOR = "#2f8bff";

interface MinimapMapConfig {
  imageUrl: string;
  dotColor: string;
  accentColor: string;
  placeholder: boolean;
}

interface MinimapWidgetIncomingMessage {
  type?: string;
}

interface MinimapInitMessage {
  type: "minimap:init";
  payload: {
    mapName: string;
    mapWidth: number;
    mapHeight: number;
    imageUrl: string;
    dotColor: string;
    accentColor: string;
    placeholder: boolean;
    tileX: number;
    tileY: number;
  };
}

interface MinimapUpdateMessage {
  type: "minimap:update";
  payload: {
    tileX: number;
    tileY: number;
  };
}

type MinimapPlayerTag = PlayerTagRecord & {
  minimapWidget?: ScriptWidget | null;
  minimapMapName?: string;
  minimapLastX?: number;
  minimapLastY?: number;
};

let minimapUpdateTimer: ReturnType<typeof setInterval> | null = null;

function getMinimapMap(): Record<string, unknown> {
  const raw = minimapMapsRaw as unknown;
  if (!raw || typeof raw !== "object") {
    return {};
  }

  return raw as Record<string, unknown>;
}

function normalizeColor(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  return value.trim();
}

function normalizeMapConfig(entry: unknown): MinimapMapConfig {
  if (!entry || typeof entry !== "object") {
    return {
      imageUrl: "",
      dotColor: DEFAULT_DOT_COLOR,
      accentColor: DEFAULT_ACCENT_COLOR,
      placeholder: true,
    };
  }

  const { imageUrl, dotColor, accentColor } = entry as {
    imageUrl?: unknown;
    dotColor?: unknown;
    accentColor?: unknown;
  };

  const normalizedImageUrl =
    typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : "";

  return {
    imageUrl: normalizedImageUrl,
    dotColor: normalizeColor(dotColor, DEFAULT_DOT_COLOR),
    accentColor: normalizeColor(accentColor, DEFAULT_ACCENT_COLOR),
    placeholder: !normalizedImageUrl,
  };
}

function getMapConfig(mapName: string): MinimapMapConfig {
  const map = getMinimapMap();
  return normalizeMapConfig(map[mapName]);
}

function getMapSize(): { width: number; height: number } {
  const width = Number(ScriptMap.width);
  const height = Number(ScriptMap.height);

  return {
    width: Number.isFinite(width) && width > 0 ? Math.floor(width) : 1,
    height: Number.isFinite(height) && height > 0 ? Math.floor(height) : 1,
  };
}

function floorCoordinate(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.floor(numeric);
}

function hasOpenMinimapWidget(): boolean {
  const players = ScriptApp.players || [];
  return players.some((player) => {
    const rawTag = player.tag;
    if (!rawTag || typeof rawTag !== "object") {
      return false;
    }

    const tag = rawTag as MinimapPlayerTag;
    return !!tag.minimapWidget;
  });
}

function stopMinimapUpdates(): void {
  if (minimapUpdateTimer !== null) {
    clearInterval(minimapUpdateTimer);
    minimapUpdateTimer = null;
  }
}

function maybeStopMinimapUpdates(): void {
  if (!hasOpenMinimapWidget()) {
    stopMinimapUpdates();
  }
}

function startMinimapUpdates(): void {
  if (minimapUpdateTimer !== null) {
    return;
  }

  minimapUpdateTimer = setInterval(() => {
    const players = ScriptApp.players || [];
    let hasOpenWidget = false;

    players.forEach((player) => {
      const rawTag = player.tag;
      if (!rawTag || typeof rawTag !== "object") {
        return;
      }

      const tag = rawTag as MinimapPlayerTag;
      const widget = tag.minimapWidget;
      if (!widget || typeof widget.sendMessage !== "function") {
        return;
      }

      hasOpenWidget = true;
      const tileX = floorCoordinate(player.tileX);
      const tileY = floorCoordinate(player.tileY);

      if (tag.minimapLastX === tileX && tag.minimapLastY === tileY) {
        return;
      }

      tag.minimapLastX = tileX;
      tag.minimapLastY = tileY;

      const message: MinimapUpdateMessage = {
        type: "minimap:update",
        payload: { tileX, tileY },
      };
      widget.sendMessage(message);
    });

    if (!hasOpenWidget) {
      stopMinimapUpdates();
    }
  }, MINIMAP_UPDATE_INTERVAL_MS);
}

function updateLastCoordinate(tag: MinimapPlayerTag, player: ScriptPlayer): void {
  tag.minimapLastX = floorCoordinate(player.tileX);
  tag.minimapLastY = floorCoordinate(player.tileY);
}

function sendInitMessage(
  widget: ScriptWidget | null | undefined,
  mapName: string,
  player: ScriptPlayer
): void {
  if (!widget || typeof widget.sendMessage !== "function") {
    return;
  }

  const mapConfig = getMapConfig(mapName);
  const { width, height } = getMapSize();
  const tileX = floorCoordinate(player.tileX);
  const tileY = floorCoordinate(player.tileY);

  const message: MinimapInitMessage = {
    type: "minimap:init",
    payload: {
      mapName,
      mapWidth: width,
      mapHeight: height,
      imageUrl: mapConfig.imageUrl,
      dotColor: mapConfig.dotColor,
      accentColor: mapConfig.accentColor,
      placeholder: mapConfig.placeholder,
      tileX,
      tileY,
    },
  };

  widget.sendMessage(message);
}

function pickWidgetDimensions(player: ScriptPlayer): {
  width: number;
  height: number;
} {
  return player.isMobile
    ? MINIMAP_WIDGET_DIMENSIONS.mobile
    : MINIMAP_WIDGET_DIMENSIONS.desktop;
}

function teardownMinimapWidget(tag: MinimapPlayerTag): void {
  const existing = tag.minimapWidget;
  tag.minimapWidget = null;
  tag.minimapMapName = undefined;
  tag.minimapLastX = undefined;
  tag.minimapLastY = undefined;

  if (existing && typeof existing.destroy === "function") {
    existing.destroy();
  }

  maybeStopMinimapUpdates();
}

function loadMinimapWidget(
  mapName: string,
  player: ScriptPlayer
): ScriptWidget | null {
  const tag = preparePlayerTag(player) as MinimapPlayerTag;
  const { width, height } = pickWidgetDimensions(player);

  if (tag.minimapWidget) {
    tag.minimapMapName = mapName;
    updateLastCoordinate(tag, player);
    sendInitMessage(tag.minimapWidget, mapName, player);
    startMinimapUpdates();
    return tag.minimapWidget;
  }

  const widget = player.showWidget(
    MINIMAP_WIDGET_TEMPLATE,
    "topright",
    width,
    height
  );

  tag.minimapWidget = widget;
  tag.minimapMapName = mapName;
  updateLastCoordinate(tag, player);

  widget.onMessage.Add((_sender, data) => {
    const message = (data ?? {}) as MinimapWidgetIncomingMessage;

    if (message.type === "minimap:close") {
      teardownMinimapWidget(tag);
      return;
    }

    if (message.type === "minimap:ready") {
      const currentMapName = tag.minimapMapName ?? mapName;
      updateLastCoordinate(tag, player);
      sendInitMessage(widget, currentMapName, player);
    }
  });

  sendInitMessage(widget, mapName, player);
  startMinimapUpdates();
  return widget;
}

export function toggleMinimapWidget(
  mapName: string,
  player: ScriptPlayer
): ScriptWidget | null {
  const tag = preparePlayerTag(player) as MinimapPlayerTag;

  if (tag.minimapWidget) {
    teardownMinimapWidget(tag);
    return null;
  }

  return loadMinimapWidget(mapName, player);
}

export function destroyMinimapSystem(): void {
  stopMinimapUpdates();

  const players = ScriptApp.players || [];
  players.forEach((player) => {
    const rawTag = player.tag;
    if (!rawTag || typeof rawTag !== "object") {
      return;
    }

    const tag = rawTag as MinimapPlayerTag;
    const existing = tag.minimapWidget;

    tag.minimapWidget = null;
    tag.minimapMapName = undefined;
    tag.minimapLastX = undefined;
    tag.minimapLastY = undefined;

    if (existing && typeof existing.destroy === "function") {
      existing.destroy();
    }
  });
}
