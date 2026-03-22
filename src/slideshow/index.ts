import type { ScriptPlayer, ScriptWidget } from "zep-script";

import { type PlayerTagRecord, preparePlayerTag } from "../utils/player";
import { SLIDESHOW_SETS, type SlideshowSlideEntry } from "./constants";

const SLIDESHOW_WIDGET_TEMPLATE = "html/slideshow-widget.html";

const SLIDESHOW_WIDGET_DIMENSIONS = Object.freeze({
  desktop: { width: 640, height: 420 },
  mobile: { width: 320, height: 360 },
});

type SlideshowPlayerTag = PlayerTagRecord & {
  slideshowWidget?: ScriptWidget | null;
  slideshowTriggerKey?: string;
};

interface SlideshowWidgetIncomingMessage {
  type?: string;
}

interface SlideshowWidgetOutgoingMessage {
  type: "slideshow:init";
  payload: {
    slides: readonly SlideshowSlideEntry[];
    startIndex: number;
  };
}

function normalizeSlideshowKey(raw: string): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  const normalized = raw.trim();
  return normalized ? normalized : null;
}

function resolveSlideshowSlides(key: string): readonly SlideshowSlideEntry[] | null {
  const normalizedKey = normalizeSlideshowKey(key);
  if (!normalizedKey) {
    return null;
  }

  const slideSet = SLIDESHOW_SETS[
    normalizedKey as keyof typeof SLIDESHOW_SETS
  ];

  return Array.isArray(slideSet) ? slideSet : null;
}

function pickWidgetDimensions(player: ScriptPlayer): {
  width: number;
  height: number;
} {
  return player.isMobile
    ? SLIDESHOW_WIDGET_DIMENSIONS.mobile
    : SLIDESHOW_WIDGET_DIMENSIONS.desktop;
}

function sendInitMessage(
  widget: ScriptWidget | null | undefined,
  slides: readonly SlideshowSlideEntry[],
  startIndex = 0
): void {
  if (!widget || typeof widget.sendMessage !== "function") {
    return;
  }

  const message: SlideshowWidgetOutgoingMessage = {
    type: "slideshow:init",
    payload: {
      slides,
      startIndex,
    },
  };

  widget.sendMessage(message);
}

function teardownSlideshowWidget(tag: SlideshowPlayerTag): void {
  const existing = tag.slideshowWidget;
  tag.slideshowWidget = null;
  tag.slideshowTriggerKey = undefined;

  if (existing && typeof existing.destroy === "function") {
    existing.destroy();
  }
}

export function toggleSlideshowWidget(player: ScriptPlayer): ScriptWidget | null {
  const tag = preparePlayerTag(player) as SlideshowPlayerTag;

  if (tag.slideshowWidget) {
    teardownSlideshowWidget(tag);
    return null;
  }

  return loadSlideshowWidget(player, "com");
}

export function openSlideshowWidget(
  player: ScriptPlayer,
  triggerKey: string
): ScriptWidget | null {
  return loadSlideshowWidget(player, triggerKey);
}

export function loadSlideshowWidget(
  player: ScriptPlayer,
  triggerKey: string
): ScriptWidget | null {
  const slides = resolveSlideshowSlides(triggerKey);
  if (!slides) {
    return null;
  }

  const tag = preparePlayerTag(player) as SlideshowPlayerTag;
  tag.slideshowTriggerKey = triggerKey;

  if (tag.slideshowWidget) {
    sendInitMessage(tag.slideshowWidget, slides, 0);
    return tag.slideshowWidget;
  }

  const { width, height } = pickWidgetDimensions(player);
  const widget = player.showWidget(
    SLIDESHOW_WIDGET_TEMPLATE,
    "middle",
    width,
    height
  );

  tag.slideshowWidget = widget;

  widget.onMessage.Add(function (_sender, data) {
    const type = (data as SlideshowWidgetIncomingMessage | undefined)?.type;

    if (type === "slideshow:close") {
      teardownSlideshowWidget(tag);
      return;
    }

    if (type === "slideshow:ready") {
      const currentSlides = resolveSlideshowSlides(tag.slideshowTriggerKey ?? triggerKey);
      if (!currentSlides) {
        return;
      }
      sendInitMessage(widget, currentSlides, 0);
    }
  });

  sendInitMessage(widget, slides, 0);
  return widget;
}

export function handleSlideshowObjectKey(
  player: ScriptPlayer,
  key: string
): boolean {
  const normalizedKey = normalizeSlideshowKey(key);
  if (!normalizedKey) {
    return false;
  }

  const slides = resolveSlideshowSlides(normalizedKey);
  if (!slides) {
    return false;
  }

  openSlideshowWidget(player, normalizedKey);
  return true;
}
