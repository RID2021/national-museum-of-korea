import type { FixTarget } from "./types";

export const FIX_GAME_MAP_NAME = "영훈당";
export const FIX_GAME_STORAGE_KEY = "fixGame";
export const FIX_GATE_TILE = { x: 39, y: 39 };
export const FIX_GATE_KEY_PREFIX = "fix-gate";

export const FIX_TARGETS: FixTarget[] = [
  { key: "fix-target-1", x: 7, y: 42 },
  { key: "fix-target-2", x: 7, y: 67 },
  { key: "fix-target-3", x: 36, y: 54 },
  { key: "fix-target-4", x: 64, y: 42 },
  { key: "fix-target-5", x: 64, y: 67 },
];
export const FIX_TARGET_COUNT = FIX_TARGETS.length;

export const brokenSprite = ScriptApp.loadSpritesheet("images/broken.png");
export const fixedSprite = ScriptApp.loadSpritesheet("images/fixed.png");
