import type { ScriptPlayer, ScriptWidget } from "zep-script";

import {
  isMissionStepComplete,
  markMissionStepComplete,
  showMissionProgress,
} from "../missionProgress";
import { findNearbyLocationName } from "../utils/location";
import {
  type PlayerTagRecord,
  preparePlayerTag,
} from "../utils/player";

const MISSION_GAME_WIDGET_TEMPLATE = "html/mission-game-widget-v31.html";

const MISSION_GAME_WIDGET_DIMENSIONS = Object.freeze({
  hunting: {
    desktop: { width: 820, height: 560 },
    mobile: { width: 340, height: 480 },
  },
  dance: {
    desktop: { width: 900, height: 620 },
    mobile: { width: 340, height: 480 },
  },
  "artifact-map": {
    desktop: { width: 980, height: 700 },
    mobile: { width: 340, height: 500 },
  },
  "sequence-choice": {
    desktop: { width: 780, height: 600 },
    mobile: { width: 340, height: 500 },
  },
});
const GAME_READY_RETRY_MS = 1100;

const GAME_TRIGGER_PREFIXES = ["game:", "wg:"] as const;
const registeredMissionGameLocationNames = new Set<string>();

type MissionGameMode = "hunting" | "dance" | "artifact-map" | "sequence-choice";

interface MissionGameImageConfig {
  alt: string;
  height: number;
  url: string;
  width: number;
}

interface MissionGameItemConfig {
  icon: string;
  id: string;
  imageUrl?: string;
  label: string;
  placedHeight?: number;
  placedWidth?: number;
  targetId: string;
}

interface MissionGameTargetConfig {
  height: number;
  id: string;
  label: string;
  placeX?: number;
  placeY?: number;
  width: number;
  x: number;
  y: number;
}

interface MissionGameDefinition {
  id: string;
  aliases?: string[];
  title: string;
  subtitle: string;
  mode: MissionGameMode;
  instruction: string;
  missionId: string;
  stepId: string;
  requiresCompletedSteps?: {
    message?: string;
    missionId: string;
    stepIds: string[];
  };
  durationSeconds?: number;
  targetScore?: number;
  sequence?: string[];
  image?: MissionGameImageConfig;
  items?: MissionGameItemConfig[];
  initialFeedback?: string;
  wrongMessage?: string;
  soundUrl?: string;
  successMessage?: string;
  targets?: MissionGameTargetConfig[];
}

type MissionGamePlayerTag = PlayerTagRecord & {
  missionGameWidget?: ScriptWidget | null;
  missionGameId?: string;
  missionGameReadyAt?: number;
  missionGameRetryCount?: number;
};

type MissionGameCompleteHandler = (
  player: ScriptPlayer,
  gameId: string
) => void;
type MissionGameWidgetAlign = Parameters<ScriptPlayer["showWidget"]>[1];

interface MissionGameIncomingMessage {
  type?: string;
}

interface MissionGamePayload {
  alreadyCompleted?: boolean;
  autoStart: boolean;
  durationSeconds: number;
  id: string;
  image?: MissionGameImageConfig;
  instruction: string;
  initialFeedback?: string;
  items?: MissionGameItemConfig[];
  missionText?: string;
  mode: MissionGameMode;
  sequence: string[];
  soundUrl?: string;
  subtitle: string;
  successMessage?: string;
  targetScore: number;
  targets?: MissionGameTargetConfig[];
  title: string;
  wrongMessage?: string;
}

interface MissionGameInitMessage {
  type: "mission-game:init";
  payload: MissionGamePayload;
}

const MISSION_GAMES: MissionGameDefinition[] = [
  {
    id: "muyongchong-hunting",
    aliases: [
      "muyongchong-archery",
      "muyongchong-archery-game",
      "godu-hunting",
      "godu-hunting-game",
      "hunting-game",
      "archery-game",
    ],
    title: "수렵도 활쏘기",
    subtitle: "고구려 무사의 말 위 활쏘기",
    mode: "hunting",
    instruction: "2분 동안 활을 당겨 맞히세요!",
    missionId: "muyongchong",
    stepId: "archery-game",
    durationSeconds: 120,
    targetScore: 5,
  },
  {
    id: "muyongchong-dance",
    aliases: [
      "muyongchong-dance-floor",
      "muyongchong-arrow-order",
      "muyongchong-arrow-order-game",
      "godu-dance",
      "godu-dance-floor",
      "dance-floor",
      "arrow-order-game",
    ],
    title: "무용도 춤 발판",
    subtitle: "무희의 동작을 따라 밟는 순서 게임",
    mode: "dance",
    instruction: "화살표 20동작을 순서대로 끝까지 밟으세요!",
    missionId: "muyongchong",
    stepId: "arrow-order-game",
    sequence: [
      "left",
      "up",
      "right",
      "down",
      "up",
      "left",
      "down",
      "right",
      "up",
      "right",
      "down",
      "left",
      "up",
      "down",
      "right",
      "left",
      "up",
      "right",
      "down",
      "up",
    ],
  },
  {
    id: "jinmyosu-artifact-map",
    aliases: [
      "muryeong-artifact-map",
      "muryeong-exchange-map",
      "muryeong-artifact-exchange",
      "exchange-region-game",
      "artifact-map",
      "artifact-exchange",
      "burial-goods-map",
      "jinmyosu-exchange-map",
    ],
    title: "부장품 교류 지도",
    subtitle: "무령왕릉 부장품으로 살펴보는 백제의 교류",
    mode: "artifact-map",
    instruction: "부장품을 알맞은 지역으로 끌어다 놓으세요.",
    missionId: "muryeong-tomb",
    stepId: "exchange-region-game",
    requiresCompletedSteps: {
      missionId: "muryeong-tomb",
      stepIds: ["bronze-mirror", "pine-coffin", "ebony-pillow"],
      message: "미션을 모두 수행하고 이동하세요.",
    },
    targetScore: 3,
    successMessage: "그렇다. 잘 짝지었구나.",
    soundUrl: "item_acquired.mp3",
    image: {
      url: "images/muryeong-trade-map.png",
      width: 1448,
      height: 1086,
      alt: "무령왕릉 부장품 교류 지도",
    },
    items: [
      {
        id: "bronze-mirror",
        icon: "銅",
        imageUrl: "images/artifacts/bronze-mirror.png",
        label: "청동거울",
        placedHeight: 128,
        placedWidth: 128,
        targetId: "china-southern",
      },
      {
        id: "pine-coffin",
        icon: "松",
        imageUrl: "images/artifacts/pine-coffin.png",
        label: "금송 목관 조각",
        placedHeight: 88,
        placedWidth: 98,
        targetId: "japan",
      },
      {
        id: "ebony-pillow",
        icon: "枕",
        imageUrl: "images/artifacts/ebony-pillow.png",
        label: "흑단 두침",
        placedHeight: 94,
        placedWidth: 122,
        targetId: "southeast-asia",
      },
    ],
    targets: [
      {
        id: "china-southern",
        label: "중국 남조",
        placeX: 319,
        placeY: 384,
        x: 240,
        y: 292,
        width: 158,
        height: 170,
      },
      {
        id: "japan",
        label: "일본",
        placeX: 1134,
        placeY: 372,
        x: 1058,
        y: 292,
        width: 165,
        height: 140,
      },
      {
        id: "southeast-asia",
        label: "동남아",
        placeX: 826,
        placeY: 787,
        x: 742,
        y: 686,
        width: 160,
        height: 150,
      },
    ],
  },
  {
    id: "cheonmachong-costume",
    aliases: [
      "cheonmachong-costume-game",
      "cheonmachong-gold-accessory",
      "cheonmachong-gold-accessory-game",
      "seoki-costume",
      "seoki-costume-game",
      "gold-accessory-game",
      "costume-restore",
      "costume",
      "silla-costume",
    ],
    title: "신라 지배층 복식 복원",
    subtitle: "금관·금허리띠·귀걸이를 알맞은 위치에 놓아 보세요.",
    mode: "artifact-map",
    instruction: "복제품 카드를 머리·허리·귀에 맞게 끌어다 놓으세요!",
    missionId: "cheonmachong",
    stepId: "gold-accessory-game",
    targetScore: 4,
    successMessage: "신라 왕과 귀족은 화려한 금으로 위엄을 뽐냈지.",
    initialFeedback: "복제품 카드를 선택해 알맞은 위치 위로 끌어 보세요.",
    wrongMessage: "석이: 허허, 그 자리는 아니야. 금관은 머리, 금허리띠는 허리, 귀걸이는 좌우 귀 위치를 다시 살펴보게.",
    soundUrl: "item_acquired.mp3",
    image: {
      url: "images/cheonmachong-costume/costume-board.jpg",
      width: 1122,
      height: 1402,
      alt: "신라 지배층 복식 복원 활동지",
    },
    items: [
      {
        id: "crown",
        icon: "冠",
        imageUrl: "images/cheonmachong-costume/crown.png",
        label: "금관",
        placedHeight: 156,
        placedWidth: 98,
        targetId: "head",
      },
      {
        id: "belt",
        icon: "帶",
        imageUrl: "images/cheonmachong-costume/belt.png",
        label: "금허리띠",
        placedHeight: 122,
        placedWidth: 210,
        targetId: "waist",
      },
      {
        id: "left-earring",
        icon: "耳",
        imageUrl: "images/cheonmachong-costume/earrings.png",
        label: "귀걸이",
        placedHeight: 126,
        placedWidth: 54,
        targetId: "left-ear",
      },
      {
        id: "right-earring",
        icon: "耳",
        imageUrl: "images/cheonmachong-costume/earrings.png",
        label: "귀걸이",
        placedHeight: 126,
        placedWidth: 54,
        targetId: "right-ear",
      },
    ],
    targets: [
      {
        id: "head",
        label: "머리",
        placeX: 570,
        placeY: 352,
        x: 480,
        y: 262,
        width: 180,
        height: 200,
      },
      {
        id: "left-ear",
        label: "왼쪽 귀",
        placeX: 476,
        placeY: 508,
        x: 425,
        y: 455,
        width: 105,
        height: 112,
      },
      {
        id: "right-ear",
        label: "오른쪽 귀",
        placeX: 665,
        placeY: 508,
        x: 615,
        y: 455,
        width: 105,
        height: 112,
      },
      {
        id: "waist",
        label: "허리",
        placeX: 570,
        placeY: 820,
        x: 450,
        y: 760,
        width: 240,
        height: 124,
      },
    ],
  },
  {
    id: "daeseongdong-iron-process",
    aliases: [
      "daeseongdong-iron-process-game",
      "gaya-iron-process",
      "gwanghoek-iron-process",
      "iron-process-game",
      "iron-production-game",
      "제련게임",
      "철생산게임",
    ],
    title: "가야 철 생산 순서",
    subtitle: "철 생산 과정을 순서대로 고르기",
    mode: "sequence-choice",
    instruction: "보기에서 정답을 순서대로 눌러 빈칸을 완성하세요.",
    missionId: "daeseongdong",
    stepId: "iron-process-game",
    requiresCompletedSteps: {
      missionId: "daeseongdong",
      stepIds: ["iron-ore", "charcoal", "bellows", "furnace"],
      message: "철 생산에 필요한 아이템을 모두 찾고 오세요.",
    },
    targetScore: 4,
    sequence: ["iron-ore", "charcoal", "bellows", "furnace"],
    successMessage: "이 철로 무기도 만들고 농기구도 만들었단다.",
    initialFeedback: "첫 번째 순서를 고르세요.",
    wrongMessage: "광획: 어허, 순서가 틀렸네. 철광석·숯·풀무·제련로 순서로 다시 보게나.",
    soundUrl: "item_acquired.mp3",
    items: [
      {
        id: "iron-ore",
        icon: "",
        label: "철광석",
        targetId: "iron-ore",
      },
      {
        id: "charcoal",
        icon: "",
        label: "숯",
        targetId: "charcoal",
      },
      {
        id: "bellows",
        icon: "",
        label: "풀무",
        targetId: "bellows",
      },
      {
        id: "furnace",
        icon: "",
        label: "제련로",
        targetId: "furnace",
      },
    ],
  },
  {
    id: "daeseongdong-artifact-match",
    aliases: [
      "daeseongdong-artifact-use",
      "gaya-artifact-match",
      "gwanghoek-artifact-match",
      "artifact-use-quiz",
      "iron-artifact-match",
      "유물짝짓기",
      "철제유물짝짓기",
    ],
    title: "철제 유물 용도 짝짓기",
    subtitle: "대성동 고분군 철제 유물의 쓰임",
    mode: "artifact-map",
    instruction: "갑옷·말갖춤·환두대도·투구를 알맞은 대상과 연결하세요!",
    missionId: "daeseongdong",
    stepId: "artifact-use-quiz",
    requiresCompletedSteps: {
      missionId: "daeseongdong",
      stepIds: ["helmet", "sword", "horse-gear", "armor"],
      message: "철제 유물을 모두 찾고 오세요.",
    },
    targetScore: 4,
    successMessage: "가야의 철은 힘과 장사 솜씨를 보여 준단다.",
    initialFeedback: "힌트: 갑옷은 장수, 말갖춤은 말, 큰 칼은 허리에!",
    wrongMessage: "광획: 어허, 짝이 틀렸네. 다시 연결해 보렴.",
    soundUrl: "item_acquired.mp3",
    image: {
      url: "images/daeseongdong/artifact-match-board.png",
      width: 1080,
      height: 761,
      alt: "가야 철제 유물 용도 짝짓기 활동지",
    },
    items: [
      {
        id: "helmet",
        icon: "兜",
        imageUrl: "images/daeseongdong/helmet.png",
        label: "투구",
        placedHeight: 100,
        placedWidth: 50,
        targetId: "helmet-target",
      },
      {
        id: "horse-gear",
        icon: "馬",
        imageUrl: "images/daeseongdong/horse-gear.png",
        label: "말갖춤",
        placedHeight: 80,
        placedWidth: 120,
        targetId: "horse-target",
      },
      {
        id: "sword",
        icon: "刀",
        imageUrl: "images/daeseongdong/sword.png",
        label: "환두대도",
        placedHeight: 78,
        placedWidth: 162,
        targetId: "warrior-target",
      },
      {
        id: "armor",
        icon: "甲",
        imageUrl: "images/daeseongdong/armor.png",
        label: "갑옷",
        placedHeight: 112,
        placedWidth: 100,
        targetId: "armor-target",
      },
    ],
    targets: [
      { id: "helmet-target", label: "투구", placeX: 905, placeY: 150, x: 780, y: 92, width: 250, height: 112 },
      { id: "horse-target", label: "말", placeX: 905, placeY: 280, x: 780, y: 222, width: 250, height: 112 },
      { id: "warrior-target", label: "허리의 큰 칼", placeX: 905, placeY: 410, x: 780, y: 352, width: 250, height: 112 },
      { id: "armor-target", label: "장수의 갑옷", placeX: 905, placeY: 540, x: 780, y: 482, width: 250, height: 112 },
    ],
  },
];

const missionGameCompleteHandlers: MissionGameCompleteHandler[] = [];

export function addMissionGameCompleteHandler(
  handler: MissionGameCompleteHandler
): void {
  missionGameCompleteHandlers.push(handler);
}

function notifyMissionGameComplete(
  player: ScriptPlayer,
  gameId: string
): void {
  missionGameCompleteHandlers.forEach(function (handler) {
    handler(player, gameId);
  });
}

function normalizeGameId(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  const [trigger] = raw.split("|");
  let normalized = (trigger ?? "").trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("#game ")) {
    normalized = `game:${normalized.slice("#game ".length).trim()}`;
  }

  const prefix = GAME_TRIGGER_PREFIXES.find(function (candidate) {
    return normalized.toLowerCase().startsWith(candidate);
  });

  if (!prefix) {
    const rawGameId = canonicalizeGameId(normalized);
    return getGameDefinition(rawGameId) ? rawGameId : null;
  }

  const gameId = canonicalizeGameId(normalized.slice(prefix.length));
  return gameId ? gameId : null;
}

function canonicalizeGameId(value: string): string {
  return value
    .trim()
    .replace(/^:+/, "")
    .replace(/\s+/g, "-")
    .replace(/:+/g, "-")
    .toLowerCase();
}

function getGameDefinition(gameId: string): MissionGameDefinition | null {
  const normalizedGameId = canonicalizeGameId(gameId);
  return (
    MISSION_GAMES.find(function (game) {
      if (canonicalizeGameId(game.id) === normalizedGameId) {
        return true;
      }

      return (game.aliases ?? []).some(function (alias) {
        return canonicalizeGameId(alias) === normalizedGameId;
      });
    }) ?? null
  );
}

function areGameRequirementsComplete(
  player: ScriptPlayer,
  game: MissionGameDefinition
): boolean {
  const requirements = game.requiresCompletedSteps;
  if (!requirements) {
    return true;
  }

  return requirements.stepIds.every(function (stepId) {
    return isMissionStepComplete(player, requirements.missionId, stepId);
  });
}

function showGameRequirementMessage(
  player: ScriptPlayer,
  game: MissionGameDefinition
): void {
  player.showCenterLabel(
    game.requiresCompletedSteps?.message ?? "미션을 모두 수행하고 이동하세요.",
    0xffffff,
    0x000000,
    420,
    3000
  );
  player.sendUpdated();
}

function pickWidgetDimensions(player: ScriptPlayer, game: MissionGameDefinition): {
  width: number;
  height: number;
} {
  const dimensions = MISSION_GAME_WIDGET_DIMENSIONS[game.mode];

  return player.isMobile
    ? dimensions.mobile
    : dimensions.desktop;
}

function pickWidgetAlign(_player: ScriptPlayer): MissionGameWidgetAlign {
  return "middle";
}

function pickWidgetTemplate(game: MissionGameDefinition): string {
  if (game.id === "daeseongdong-artifact-match") {
    return "html/daeseongdong-artifact-link-widget-v1.html";
  }

  if (game.mode === "artifact-map") {
    return "html/artifact-map-widget-v2.html";
  }

  if (game.mode === "sequence-choice") {
    return "html/sequence-choice-widget-v6.html";
  }

  return MISSION_GAME_WIDGET_TEMPLATE;
}

function buildGamePayload(
  game: MissionGameDefinition,
  options?: { autoStart?: boolean }
): MissionGamePayload {
  return {
    alreadyCompleted: false,
    autoStart: options?.autoStart === true,
    durationSeconds: game.durationSeconds ?? 0,
    id: game.id,
    image: game.image,
    instruction: game.instruction,
    initialFeedback: game.initialFeedback,
    items: game.items,
    missionText: game.instruction,
    mode: game.mode,
    sequence: game.sequence ?? [],
    soundUrl: game.soundUrl,
    subtitle: game.subtitle,
    successMessage: game.successMessage,
    targetScore: game.targetScore ?? 0,
    targets: game.targets,
    title: game.title,
    wrongMessage: game.wrongMessage,
  };
}

function sendGameInit(
  widget: ScriptWidget | null | undefined,
  game: MissionGameDefinition,
  options?: { autoStart?: boolean }
): void {
  if (!widget || typeof widget.sendMessage !== "function") {
    return;
  }

  const message: MissionGameInitMessage = {
    type: "mission-game:init",
    payload: buildGamePayload(game, options),
  };

  widget.sendMessage(message);
}

function teardownMissionGameWidget(tag: MissionGamePlayerTag): void {
  const existing = tag.missionGameWidget;
  tag.missionGameWidget = null;
  tag.missionGameId = undefined;
  tag.missionGameReadyAt = undefined;
  tag.missionGameRetryCount = undefined;

  if (existing && typeof existing.destroy === "function") {
    existing.destroy();
  }
}

function scheduleReadyRetry(
  player: ScriptPlayer,
  game: MissionGameDefinition,
  retryCountAtOpen: number
): void {
  if (retryCountAtOpen > 0) {
    return;
  }

  setTimeout(function () {
    const tag = preparePlayerTag(player) as MissionGamePlayerTag;
    if (
      tag.missionGameId !== game.id ||
      tag.missionGameReadyAt ||
      Number(tag.missionGameRetryCount ?? 0) !== retryCountAtOpen
    ) {
      return;
    }

    const existing = tag.missionGameWidget;
    tag.missionGameWidget = null;
    tag.missionGameId = undefined;
    tag.missionGameReadyAt = undefined;
    tag.missionGameRetryCount = retryCountAtOpen + 1;
    if (existing && typeof existing.destroy === "function") {
      existing.destroy();
    }
    openMissionGame(player, game);
  }, GAME_READY_RETRY_MS);
}

function openMissionGame(
  player: ScriptPlayer,
  game: MissionGameDefinition
): ScriptWidget | null {
  const tag = preparePlayerTag(player) as MissionGamePlayerTag;

  if (tag.missionGameWidget) {
    teardownMissionGameWidget(tag);
  }

  const retryCountAtOpen = Number(tag.missionGameRetryCount ?? 0);

  const { width, height } = pickWidgetDimensions(player, game);
  const align = pickWidgetAlign(player);
  const widget = player.showWidget(
    pickWidgetTemplate(game),
    align,
    width,
    height
  );

  tag.missionGameWidget = widget;
  tag.missionGameId = game.id;
  tag.missionGameReadyAt = undefined;
  tag.missionGameRetryCount = retryCountAtOpen;

  widget.onMessage.Add(function (_sender, data) {
    const message = data as MissionGameIncomingMessage | undefined;
    const type = message?.type;

    if (type === "mission-game:close") {
      teardownMissionGameWidget(tag);
      return;
    }

    const currentGame = getGameDefinition(tag.missionGameId ?? game.id);
    if (!currentGame) {
      return;
    }

    if (type === "mission-game:ready") {
      tag.missionGameReadyAt = Date.now();
      sendGameInit(widget, currentGame, { autoStart: player.isMobile });
      return;
    }

    if (type === "mission-game:complete") {
      markMissionStepComplete(
        player,
        currentGame.missionId,
        currentGame.stepId
      );
      setTimeout(function () {
        teardownMissionGameWidget(tag);
        notifyMissionGameComplete(player, currentGame.id);
      }, 1000);
      return;
    }

    if (type === "mission-game:show-progress") {
      showMissionProgress(player, ScriptMap.name);
    }
  });

  sendGameInit(widget, game, { autoStart: player.isMobile });
  scheduleReadyRetry(player, game, retryCountAtOpen);
  return widget;
}

export function handleMissionGameTrigger(
  player: ScriptPlayer,
  rawTrigger: unknown
): boolean {
  const gameId = normalizeGameId(rawTrigger);
  if (!gameId) {
    return false;
  }

  const game = getGameDefinition(gameId);
  if (!game) {
    return false;
  }

  if (!areGameRequirementsComplete(player, game)) {
    showGameRequirementMessage(player, game);
    return true;
  }

  openMissionGame(player, game);
  return true;
}

export function handleMissionGameObjectKey(
  player: ScriptPlayer,
  key: unknown
): boolean {
  return handleMissionGameTrigger(player, key);
}

function addMissionGameLocationTrigger(locationName: string): void {
  if (registeredMissionGameLocationNames.has(locationName)) {
    return;
  }

  registeredMissionGameLocationNames.add(locationName);
  ScriptApp.addOnLocationEnter(locationName, function (player: ScriptPlayer) {
    handleMissionGameTrigger(player, locationName);
  });
  ScriptApp.addOnLocationTouched(locationName, function (player: ScriptPlayer) {
    handleMissionGameTrigger(player, locationName);
  });
}

export function handleNearbyMissionGameLocation(
  player: ScriptPlayer,
  radius = 1
): boolean {
  const locationName = findNearbyLocationName(
    player,
    registeredMissionGameLocationNames,
    radius
  );

  return locationName ? handleMissionGameTrigger(player, locationName) : false;
}

export function registerMissionGameLocations(): void {
  MISSION_GAMES.forEach(function (game) {
    const triggerIds = new Set([game.id, ...(game.aliases ?? [])]);

    GAME_TRIGGER_PREFIXES.forEach(function (prefix) {
      triggerIds.forEach(function (triggerId) {
        addMissionGameLocationTrigger(`${prefix}${triggerId}`);
      });
    });

    triggerIds.forEach(function (triggerId) {
      addMissionGameLocationTrigger(triggerId);
    });
  });
}
