import type { ScriptPlayer, ScriptWidget } from "zep-script";

import {
  preparePlayerStorage,
  savePlayerStorage,
  preparePlayerTag,
  PlayerTagRecord,
  PlayerStorageRecord,
} from "../utils/player";

import {
  InventoryItem,
  InventoryState,
  InventorySize,
  InventoryWidgetMessage,
  InventoryWidgetAlign,
  ShowInventoryOptions,
} from "./interfaces";
import { earnItemMap } from "./constants";
import type { EarnedItemEntry, EarnedItemConfig } from "./constants";
type PlayerStorageData = PlayerStorageRecord & {
  inventory?: InventoryState;
  [key: string]: unknown;
};

const STORAGE_KEY = "inventory";

export const DEFAULT_INVENTORY_SIZE: InventorySize = Object.freeze({
  rows: 4,
  cols: 3,
});

const DEFAULT_WIDGET_DIMENSIONS = Object.freeze({
  desktop: { width: 620, height: 760 },
  mobile: { width: 460, height: 820 },
});

const TEMPLATE_BY_DEVICE = Object.freeze({
  desktop: "html/inventory-desktop.html",
  mobile: "html/inventory-mobile.html",
});

interface NormalizedEarnedItemConfig {
  name: string;
  url: string;
  description: string;
  quantity: number;
}

interface ResolvedEarnedItem {
  items: NormalizedEarnedItemConfig[];
  mobileMessage: string;
  pcMessage: string;
  removeItemList: string[];
}

type InventoryPlayerTag = PlayerTagRecord & {
  inventoryWidget?: ScriptWidget | null;
  inventoryWidgetOptions?: ShowInventoryOptions | undefined;
};

function readPlayerStorage(player: ScriptPlayer): PlayerStorageData {
  return preparePlayerStorage<PlayerStorageData>(player);
}

function normalizeSize(size?: InventorySize): InventorySize {
  const fallback = DEFAULT_INVENTORY_SIZE;
  if (!size) {
    return { ...fallback };
  }

  const rows = Number.isFinite(size.rows)
    ? Math.max(1, Math.floor(size.rows))
    : fallback.rows;
  const cols = Number.isFinite(size.cols)
    ? Math.max(1, Math.floor(size.cols))
    : fallback.cols;

  return { rows, cols };
}

function ensureStateStructure(
  state: InventoryState | undefined,
  size: InventorySize
): InventoryState {
  if (!state) {
    return { size, items: [] };
  }

  const normalizedSize = normalizeSize(state.size);
  const normalizedItems = Array.isArray(state.items)
    ? (state.items.map(normalizeItem).filter(Boolean) as InventoryItem[])
    : [];

  return { size: normalizedSize, items: normalizedItems };
}

function normalizeItem(item: unknown): InventoryItem | undefined {
  if (!item || typeof item !== "object") {
    return undefined;
  }

  const { name, imageUrl, description, quantity } = item as InventoryItem;

  if (typeof name !== "string" || !name.trim()) {
    return undefined;
  }

  const normalizedQuantity = Number.isFinite(quantity)
    ? Math.max(1, Math.floor(quantity))
    : 1;

  return {
    name,
    imageUrl: typeof imageUrl === "string" ? imageUrl : "",
    description: typeof description === "string" ? description : "",
    quantity: normalizedQuantity,
  };
}

function normalizeRemovalList(list: unknown): string[] {
  if (!Array.isArray(list)) {
    return [];
  }

  return Array.from(
    new Set(
      list
        .map((entry) =>
          typeof entry === "string" ? entry.trim() : ""
        )
        .filter(Boolean)
    )
  );
}

function normalizeEarnedItemConfig(
  item: unknown
): NormalizedEarnedItemConfig | undefined {
  if (!item || typeof item !== "object") {
    return undefined;
  }

  const { name, url, description, quantity } = item as EarnedItemConfig;

  if (typeof name !== "string" || !name.trim()) {
    return undefined;
  }

  if (typeof url !== "string" || !url.trim()) {
    return undefined;
  }

  const normalizedQuantity = Number.isFinite(quantity)
    ? Math.max(1, Math.floor(quantity as number))
    : 1;

  return {
    name: name.trim(),
    url: url.trim(),
    description: typeof description === "string" ? description : "",
    quantity: normalizedQuantity,
  };
}

function normalizeEarnedItemList(
  list: unknown
): NormalizedEarnedItemConfig[] {
  if (!Array.isArray(list)) {
    return [];
  }

  return list
    .map((entry) => normalizeEarnedItemConfig(entry))
    .filter(Boolean) as NormalizedEarnedItemConfig[];
}

function resolveEarnedItem(mapName: string): ResolvedEarnedItem | undefined {
  const entry = (earnItemMap as Record<string, EarnedItemEntry | undefined>)[
    mapName
  ];

  if (!entry) {
    return undefined;
  }

  const items = normalizeEarnedItemList(entry.earnItemList);
  if (items.length === 0) {
    return undefined;
  }

  const mobileMessage =
    typeof entry.mobileMessage === "string" ? entry.mobileMessage : "";
  const pcMessage =
    typeof entry.pcMessage === "string" ? entry.pcMessage : "";

  if (!mobileMessage.trim() && !pcMessage.trim()) {
    return undefined;
  }

  return {
    items,
    mobileMessage,
    pcMessage,
    removeItemList: normalizeRemovalList(entry.removeItemList),
  };
}

function cloneShowInventoryOptions(
  options: ShowInventoryOptions | undefined
): ShowInventoryOptions | undefined {
  if (!options) {
    return undefined;
  }

  const cloned: ShowInventoryOptions = { ...options };
  if (options.size) {
    cloned.size = { ...options.size };
  }

  return cloned;
}

function persistInventory(
  player: ScriptPlayer,
  storage: PlayerStorageData,
  state: InventoryState
): InventoryState {
  storage[STORAGE_KEY] = state;
  savePlayerStorage(player, storage, { persist: true });
  return state;
}

export function getInventory(player: ScriptPlayer): InventoryState {
  const storage = readPlayerStorage(player);
  const size = normalizeSize(storage[STORAGE_KEY]?.size);
  const state = ensureStateStructure(storage[STORAGE_KEY], size);
  return state;
}

export function ensureInventory(
  player: ScriptPlayer,
  size?: InventorySize
): InventoryState {
  const desiredSize = normalizeSize(size);
  const storage = readPlayerStorage(player);
  const state = ensureStateStructure(storage[STORAGE_KEY], desiredSize);
  if (!storage[STORAGE_KEY]) {
    return persistInventory(player, storage, state);
  }

  if (
    state.size.rows !== desiredSize.rows ||
    state.size.cols !== desiredSize.cols
  ) {
    state.size = desiredSize;
    return persistInventory(player, storage, state);
  }

  return state;
}

export function setInventorySize(
  player: ScriptPlayer,
  size: InventorySize
): InventoryState {
  const storage = readPlayerStorage(player);
  const state = ensureStateStructure(storage[STORAGE_KEY], normalizeSize(size));
  state.size = normalizeSize(size);
  return persistInventory(player, storage, state);
}

export function setInventoryItems(
  player: ScriptPlayer,
  items: InventoryItem[]
): InventoryState {
  const storage = readPlayerStorage(player);
  const state = ensureStateStructure(
    storage[STORAGE_KEY],
    normalizeSize(storage[STORAGE_KEY]?.size)
  );
  state.items = items.map(normalizeItem).filter(Boolean) as InventoryItem[];
  if (!state.size) {
    state.size = normalizeSize(undefined);
  }
  return persistInventory(player, storage, state);
}

export function addInventoryItem(
  player: ScriptPlayer,
  item: InventoryItem
): InventoryState {
  const storage = readPlayerStorage(player);
  const state = ensureStateStructure(
    storage[STORAGE_KEY],
    normalizeSize(storage[STORAGE_KEY]?.size)
  );
  const normalized = normalizeItem(item);

  if (!normalized) {
    return state;
  }

  const hasSameItem = state.items.some(
    (entry) => entry.name === normalized.name
  );

  if (hasSameItem) {
    return state;
  }

  state.items.push(normalized);
  persistInventory(player, storage, state);

  return state;
}

export function addInventoryItemByMapName(
  mapName: string,
  player: ScriptPlayer
): InventoryState {
  const config = resolveEarnedItem(mapName);

  if (!config) {
    return getInventory(player);
  }

  const inventory = getInventory(player);
  let finalState = inventory;
  let addedAny = false;

  for (const itemConfig of config.items) {
    const exists = finalState.items.some(
      (entry) => entry.name === itemConfig.name
    );
    if (exists) {
      continue;
    }

    finalState = addInventoryItem(player, {
      name: itemConfig.name,
      imageUrl: itemConfig.url,
      description: itemConfig.description,
      quantity: itemConfig.quantity,
    });
    addedAny = true;
  }

  if (!addedAny) {
    return finalState;
  }

  if (config.removeItemList.length > 0) {
    for (const itemName of config.removeItemList) {
      const existing = finalState.items.find(
        (entry) => entry.name === itemName
      );
      if (!existing) {
        continue;
      }
      finalState = removeInventoryItem(player, itemName, existing.quantity);
    }
  }

  player.showCustomLabel(
    player.isMobile ? config.mobileMessage : config.pcMessage,
    0xffffff,
    0x000000,
    0,
    player.isMobile ? 65 : 55,
    0.6,
    4000,
    {
      borderRadius: "8px",
      padding: "4px",
    }
  );
  player.sendUpdated();
  player.save();

  const tag = preparePlayerTag(player) as InventoryPlayerTag;
  if (tag.inventoryWidget) {
    const previousOptions = cloneShowInventoryOptions(
      tag.inventoryWidgetOptions
    );
    teardownInventoryWidget(player);
    showInventoryWidget(player, previousOptions);
  }

  return finalState;
}

export function removeInventoryItem(
  player: ScriptPlayer,
  name: string,
  quantity = 1
): InventoryState {
  const storage = readPlayerStorage(player);
  const state = ensureStateStructure(
    storage[STORAGE_KEY],
    normalizeSize(storage[STORAGE_KEY]?.size)
  );
  const normalizedQuantity = Math.max(1, Math.floor(quantity));
  const index = state.items.findIndex((entry) => entry.name === name);

  if (index >= 0) {
    const item = state.items[index];
    if (item.quantity <= normalizedQuantity) {
      state.items.splice(index, 1);
    } else {
      state.items[index] = {
        ...item,
        quantity: item.quantity - normalizedQuantity,
      };
    }
    persistInventory(player, storage, state);
  }

  return state;
}

export function clearInventoryItems(player: ScriptPlayer): InventoryState {
  const storage = readPlayerStorage(player);
  const state = ensureStateStructure(
    storage[STORAGE_KEY],
    normalizeSize(storage[STORAGE_KEY]?.size)
  );

  if (state.items.length > 0) {
    state.items = [];
    persistInventory(player, storage, state);
  }

  return state;
}

function pickTemplate(
  player: ScriptPlayer,
  requested?: "desktop" | "mobile"
): { template: string; mode: "desktop" | "mobile" } {
  if (requested) {
    return { template: TEMPLATE_BY_DEVICE[requested], mode: requested };
  }

  return player.isMobile
    ? { template: TEMPLATE_BY_DEVICE.mobile, mode: "mobile" }
    : { template: TEMPLATE_BY_DEVICE.desktop, mode: "desktop" };
}

function pickAlign(align?: InventoryWidgetAlign): InventoryWidgetAlign {
  return align ?? "popup";
}

function pickDimensions(
  mode: "desktop" | "mobile",
  options?: ShowInventoryOptions
): { width: number; height: number } {
  if (
    typeof options?.width === "number" &&
    typeof options?.height === "number"
  ) {
    return { width: options.width, height: options.height };
  }

  return DEFAULT_WIDGET_DIMENSIONS[mode];
}

function sendWidgetInit(
  player: ScriptPlayer,
  widget: ScriptWidget | null | undefined
): void {
  if (!widget || typeof widget.sendMessage !== "function") {
    return;
  }

  const message: InventoryWidgetMessage = {
    type: "inventory:init",
    payload: getInventory(player),
  };

  widget.sendMessage(message);
}

function teardownInventoryWidget(player: ScriptPlayer): void {
  const tag = preparePlayerTag(player) as InventoryPlayerTag;
  const existing = tag.inventoryWidget as ScriptWidget | undefined;

  tag.inventoryWidget = null;
  tag.inventoryWidgetOptions = undefined;

  if (existing && typeof existing.destroy === "function") {
    existing.destroy();
  }
}

export function showInventoryWidget(
  player: ScriptPlayer,
  options?: ShowInventoryOptions
): ScriptWidget | null {
  const tag = preparePlayerTag(player) as InventoryPlayerTag;
  const existing = tag.inventoryWidget as ScriptWidget | undefined;

  if (existing) {
    teardownInventoryWidget(player);
    return null;
  }

  ensureInventory(player, options?.size);
  const { template, mode } = pickTemplate(player, options?.template);
  const align = pickAlign(options?.align);
  const { width, height } = pickDimensions(mode, options);

  const widget = player.showWidget(template, align, width, height);
  tag.inventoryWidget = widget;
  tag.inventoryWidgetOptions = cloneShowInventoryOptions(options);

  widget.onMessage.Add(function (_sender, data) {
    if (
      data &&
      typeof data === "object" &&
      (data as { type?: string }).type === "inventory:close"
    ) {
      teardownInventoryWidget(player);
    }
  });
  sendWidgetInit(player, widget);
  player.sendUpdated();
  return widget;
}
