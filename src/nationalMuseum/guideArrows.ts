import type { ScriptPlayer } from "zep-script";

import { loadPlayerStorage, savePlayerStorage } from "../utils/player";
import { MUSEUM_MAPS } from "./navigation";

const SPACE_HASH_ID = "nLP9zE";
const PENSIVE_GUIDE_STAGE_KEY = "museumPensiveGuideStage";
const PENSIVE_ARROW_KEY = "museum-guide-arrow:pensive:gif";
const LEGACY_ARROW_KEYS = [
  "museum-guide-arrow:pensive:1",
  "museum-guide-arrow:pensive:2",
] as const;

const PENSIVE_GUIDE_STEPS = [
  { x: 40, y: 25 },
  { x: 18, y: 25 },
] as const;

// ZEP freezes native GIF resources at frame zero. This sheet contains all 58
// frames from the uploaded GIF in row-major order, preserving its 25 fps loop.
const pensiveArrowGif = ScriptApp.loadSpritesheet(
  "images/guide-arrows/up.png",
  67,
  120,
  { idle: Array.from({ length: 58 }, function (_value, index) { return index; }) },
  25
);

function isPensiveRoom(): boolean {
  return (
    ScriptApp.spaceHashID === SPACE_HASH_ID &&
    ScriptApp.mapHashID === MUSEUM_MAPS.pensive
  );
}

export function getPensiveGuideStage(player: ScriptPlayer): number {
  const value = Number(loadPlayerStorage(player)[PENSIVE_GUIDE_STAGE_KEY] ?? 0);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(PENSIVE_GUIDE_STEPS.length, Math.floor(value)));
}

function savePensiveGuideStage(player: ScriptPlayer, stage: number): void {
  const storage = loadPlayerStorage(player);
  savePlayerStorage(
    player,
    {
      ...storage,
      [PENSIVE_GUIDE_STAGE_KEY]: stage,
    },
    { persist: true }
  );
}

function removeArrow(key: string): void {
  try {
    const object = ScriptMap.getObjectWithKey(key) as
      | { tileX?: number; tileY?: number }
      | null;
    if (
      object &&
      typeof object.tileX === "number" &&
      typeof object.tileY === "number"
    ) {
      ScriptMap.putObjectWithKey(object.tileX, object.tileY, null, { key });
    }
  } catch (_error) {
    // The arrow has already been removed.
  }
}

function renderPensiveGuideStage(stage: number): void {
  if (!isPensiveRoom()) {
    return;
  }

  [PENSIVE_ARROW_KEY, ...LEGACY_ARROW_KEYS].forEach(function (key) {
    removeArrow(key);
  });

  const target = PENSIVE_GUIDE_STEPS[stage];
  if (!target) {
    return;
  }

  ScriptMap.putObjectWithKey(target.x, target.y, pensiveArrowGif, {
    key: PENSIVE_ARROW_KEY,
    overlap: true,
    useDirAnim: false,
  });
  ScriptMap.playObjectAnimationWithKey(PENSIVE_ARROW_KEY, "idle", -1);
}

export function syncPensiveGuideArrow(player: ScriptPlayer): void {
  renderPensiveGuideStage(getPensiveGuideStage(player));
}

export function completePensiveGuideFirstStep(player: ScriptPlayer): void {
  if (!isPensiveRoom() || getPensiveGuideStage(player) > 0) {
    return;
  }
  savePensiveGuideStage(player, 1);
  renderPensiveGuideStage(1);
}

export function completePensiveGuideRoute(player: ScriptPlayer): void {
  if (!isPensiveRoom() || getPensiveGuideStage(player) !== 1) {
    return;
  }
  savePensiveGuideStage(player, PENSIVE_GUIDE_STEPS.length);
  renderPensiveGuideStage(PENSIVE_GUIDE_STEPS.length);
}

export function resetPensiveGuideArrow(player: ScriptPlayer): void {
  savePensiveGuideStage(player, 0);
  renderPensiveGuideStage(0);
}
