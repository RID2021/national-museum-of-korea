import { doubleTaskMap } from "../task/constants";
import { tileMessageMap } from "../tileMessages";

export interface SlideshowSlideEntry {
  imageUrl: string;
  text: string;
}

type SlideshowStage = "before" | "after";

const STAGE_DESCRIPTION = Object.freeze({
  before: "[[orange:복원 전]] 장면입니다.",
  after: "[[orange:복원 후]] 장면입니다.",
});

const SLIDESHOW_MAP_NAMES = Object.freeze(Object.keys(doubleTaskMap));

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function buildSlideText(mapName: string, stage: SlideshowStage): string {
  const missionText = decodeHtmlEntities(tileMessageMap[mapName]?.message ?? "");
  const stageText = STAGE_DESCRIPTION[stage];
  const detailText = [missionText, stageText].filter(Boolean).join(" ");

  return [mapName, detailText].filter(Boolean).join("\n");
}

function createSlideshowSet(stage: SlideshowStage): readonly SlideshowSlideEntry[] {
  return SLIDESHOW_MAP_NAMES.flatMap((mapName) => {
    const entry = doubleTaskMap[mapName as keyof typeof doubleTaskMap];
    const imageUrl = entry?.[stage];

    if (typeof imageUrl !== "string" || !imageUrl.trim()) {
      return [];
    }

    return [
      {
        imageUrl: imageUrl.trim(),
        text: buildSlideText(mapName, stage),
      },
    ];
  });
}

export const SLIDESHOW_SETS = Object.freeze({
  com: createSlideshowSet("before"),
  com2: createSlideshowSet("after"),
});
