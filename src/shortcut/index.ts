import type { ScriptPlayer, ScriptWidget } from "zep-script";

import { debugMessage } from "../utils/message";
import { preparePlayerTag, type PlayerTagRecord } from "../utils/player";
import teleportShortcutsRaw from "./teleportShortcuts.json";

const TELEPORT_WIDGET_TEMPLATE = "html/teleport-shortcut-widget.html";

const TELEPORT_WIDGET_DIMENSIONS = Object.freeze({
  desktop: { width: 340, height: 460 },
  mobile: { width: 320, height: 420 },
});

interface TeleportShortcut {
  id: string;
  label: string;
  description: string;
  x?: number;
  y?: number;
  url?: string;
}

interface ShortcutTheme {
  mainColor: string;
  hoverColor: string;
}

interface ShortcutMapConfig {
  shortcuts: TeleportShortcut[];
  theme: ShortcutTheme;
}

interface ShortcutWidgetIncomingMessage {
  type?: string;
  payload?: {
    id?: string;
  };
}

interface ShortcutWidgetOutgoingMessage {
  type: "shortcut:init";
  payload: {
    mapName: string;
    theme: ShortcutTheme;
    shortcuts: Array<{
      id: string;
      label: string;
      description: string;
      url?: string;
    }>;
  };
}

type ShortcutPlayerTag = PlayerTagRecord & {
  teleportShortcutWidget?: ScriptWidget | null;
  teleportShortcutMapName?: string;
};

const DEFAULT_THEME: ShortcutTheme = Object.freeze({
  mainColor: "#2f8bff",
  hoverColor: "#5cabff",
});

function normalizeShortcut(entry: unknown): TeleportShortcut | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const { id, label, x, y, description, url } = entry as {
    id?: unknown;
    label?: unknown;
    x?: unknown;
    y?: unknown;
    description?: unknown;
    url?: unknown;
  };

  if (typeof id !== "string" || !id.trim()) {
    return null;
  }

  if (typeof label !== "string" || !label.trim()) {
    return null;
  }

  const normalizedUrl =
    typeof url === "string" && /^https?:\/\//i.test(url.trim())
      ? url.trim()
      : "";
  const hasPosition = Number.isFinite(x) && Number.isFinite(y);

  if (!hasPosition && !normalizedUrl) {
    return null;
  }

  const normalized: TeleportShortcut = {
    id: id.trim(),
    label: label.trim(),
    description: typeof description === "string" ? description : "",
  };

  if (hasPosition) {
    normalized.x = Math.floor(x as number);
    normalized.y = Math.floor(y as number);
  }

  if (normalizedUrl) {
    normalized.url = normalizedUrl;
  }

  return normalized;
}

function hasTeleportCoordinates(shortcut: TeleportShortcut): boolean {
  return Number.isFinite(shortcut.x) && Number.isFinite(shortcut.y);
}

function getTeleportTarget(
  shortcut: TeleportShortcut
): { x: number; y: number } | null {
  if (!hasTeleportCoordinates(shortcut)) {
    return null;
  }

  return {
    x: Math.floor(shortcut.x as number),
    y: Math.floor(shortcut.y as number),
  };
}

function getShortcutMap(): Record<string, unknown> {
  const raw = teleportShortcutsRaw as unknown;
  if (!raw || typeof raw !== "object") {
    return {};
  }

  return raw as Record<string, unknown>;
}

function normalizeTheme(theme: unknown): ShortcutTheme {
  if (!theme || typeof theme !== "object") {
    return { ...DEFAULT_THEME };
  }

  const { mainColor, hoverColor } = theme as {
    mainColor?: unknown;
    hoverColor?: unknown;
  };

  return {
    mainColor:
      typeof mainColor === "string" && mainColor.trim()
        ? mainColor.trim()
        : DEFAULT_THEME.mainColor,
    hoverColor:
      typeof hoverColor === "string" && hoverColor.trim()
        ? hoverColor.trim()
        : DEFAULT_THEME.hoverColor,
  };
}

function getShortcutConfig(mapName: string): ShortcutMapConfig {
  const shortcutMap = getShortcutMap();
  const entry = shortcutMap[mapName] as unknown;

  const fallback: ShortcutMapConfig = {
    shortcuts: [],
    theme: { ...DEFAULT_THEME },
  };

  // Backward compatibility: mapName: Shortcut[]
  if (Array.isArray(entry)) {
    return {
      shortcuts: entry
        .map((item) => normalizeShortcut(item))
        .filter(Boolean) as TeleportShortcut[],
      theme: { ...DEFAULT_THEME },
    };
  }

  if (!entry || typeof entry !== "object") {
    return fallback;
  }

  const config = entry as {
    shortcuts?: unknown;
    theme?: unknown;
  };

  const list = Array.isArray(config.shortcuts) ? config.shortcuts : [];

  return {
    shortcuts: list
      .map((item) => normalizeShortcut(item))
      .filter(Boolean) as TeleportShortcut[],
    theme: normalizeTheme(config.theme),
  };
}

function pickWidgetDimensions(player: ScriptPlayer): {
  width: number;
  height: number;
} {
  return player.isMobile
    ? TELEPORT_WIDGET_DIMENSIONS.mobile
    : TELEPORT_WIDGET_DIMENSIONS.desktop;
}

function sendInitMessage(
  widget: ScriptWidget | null | undefined,
  mapName: string,
  config: ShortcutMapConfig
): void {
  if (!widget || typeof widget.sendMessage !== "function") {
    return;
  }

  const message: ShortcutWidgetOutgoingMessage = {
    type: "shortcut:init",
    payload: {
      mapName,
      theme: config.theme,
      shortcuts: config.shortcuts.map((shortcut) => ({
        id: shortcut.id,
        label: shortcut.label,
        description: shortcut.description,
        url: shortcut.url,
      })),
    },
  };

  widget.sendMessage(message);
}

function teardownTeleportShortcutWidget(tag: ShortcutPlayerTag): void {
  const existing = tag.teleportShortcutWidget;
  tag.teleportShortcutWidget = null;
  tag.teleportShortcutMapName = undefined;

  if (existing && typeof existing.destroy === "function") {
    existing.destroy();
  }
}

function handleTeleportRequest(
  player: ScriptPlayer,
  mapName: string,
  shortcutId: string
): void {
  const config = getShortcutConfig(mapName);
  const target = config.shortcuts.find((shortcut) => shortcut.id === shortcutId);

  if (!target) {
    debugMessage({
      type: "shortcut:missing-target",
      mapName,
      shortcutId,
    });
    return;
  }

  const teleportTarget = getTeleportTarget(target);
  if (!teleportTarget) {
    debugMessage({
      type: "shortcut:missing-position",
      mapName,
      shortcutId,
    });
    return;
  }

  player.spawnAt(teleportTarget.x, teleportTarget.y);
  player.showCenterLabel(`${target.label} 위치로 이동했습니다.`);
  player.sendUpdated();
}

export function toggleTeleportShortcutWidget(
  mapName: string,
  player: ScriptPlayer
): ScriptWidget | null {
  const tag = preparePlayerTag(player) as ShortcutPlayerTag;

  if (tag.teleportShortcutWidget) {
    teardownTeleportShortcutWidget(tag);
    return null;
  }

  return loadTeleportShortcutWidget(mapName, player);
}

export function loadTeleportShortcutWidget(
  mapName: string,
  player: ScriptPlayer
): ScriptWidget | null {
  const tag = preparePlayerTag(player) as ShortcutPlayerTag;
  const config = getShortcutConfig(mapName);
  const { width, height } = pickWidgetDimensions(player);

  if (tag.teleportShortcutWidget) {
    tag.teleportShortcutMapName = mapName;
    sendInitMessage(tag.teleportShortcutWidget, mapName, config);
    return tag.teleportShortcutWidget;
  }

  const widget = player.showWidget(
    TELEPORT_WIDGET_TEMPLATE,
    "middle",
    width,
    height
  );

  tag.teleportShortcutWidget = widget;
  tag.teleportShortcutMapName = mapName;

  widget.onMessage.Add(function (_sender, data) {
    const message = (data ?? {}) as ShortcutWidgetIncomingMessage;

    if (message.type === "shortcut:close") {
      teardownTeleportShortcutWidget(tag);
      return;
    }

    if (message.type === "shortcut:ready") {
      const currentMapName = tag.teleportShortcutMapName ?? mapName;
      sendInitMessage(widget, currentMapName, getShortcutConfig(currentMapName));
      return;
    }

    if (message.type === "shortcut:teleport") {
      const shortcutId = message.payload?.id;
      if (typeof shortcutId !== "string" || !shortcutId.trim()) {
        return;
      }

      const targetMapName = tag.teleportShortcutMapName ?? mapName;
      handleTeleportRequest(player, targetMapName, shortcutId.trim());
      teardownTeleportShortcutWidget(tag);
    }
  });

  sendInitMessage(widget, mapName, config);
  return widget;
}
