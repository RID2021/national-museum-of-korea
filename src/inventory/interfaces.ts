import type { ScriptPlayer } from "zep-script";

export interface InventorySize {
  rows: number;
  cols: number;
}

export interface InventoryItem {
  name: string;
  imageUrl: string;
  description: string;
  quantity: number;
}

export interface InventoryState {
  size: InventorySize;
  items: InventoryItem[];
}

export type InventoryWidgetAlign = Parameters<ScriptPlayer["showWidget"]>[1];

export interface ShowInventoryOptions {
  size?: InventorySize;
  align?: InventoryWidgetAlign;
  width?: number;
  height?: number;
  template?: "desktop" | "mobile";
}

export interface InventoryWidgetMessage {
  type: "inventory:init" | "inventory:update";
  payload: InventoryState;
}
