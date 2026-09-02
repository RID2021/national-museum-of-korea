import type { ScriptPlayer, ScriptWidget } from "zep-script";

import {
  type PlayerTagRecord,
  loadPlayerStorage,
  preparePlayerTag,
  savePlayerStorage,
} from "../utils/player";
import { findNearbyLocationName } from "../utils/location";

const STORAGE_KEY = "missionProgress";
const MISSION_PROGRESS_WIDGET_TEMPLATE = "html/mission-progress-widget.html";
const registeredMissionProgressLocationNames = new Set<string>();
const OVERALL_MISSION_ID = "overall";
const OVERALL_MISSION_TITLE = "전체 미션 진행률";
const MUSEUM_BUTTON_LABEL = "국립중앙박물관으로 이동하기";
const MUSEUM_LOCKED_MESSAGE =
  "거울의 방에서 청동거울 완성 영상을 확인한 후 이동할 수 있습니다.";
const NATIONAL_MUSEUM_SPACE_HASH_ID = "nLP9zE";
const NATIONAL_MUSEUM_ENTRY_MAP_HASH_ID = "R57laZ";

const MISSION_PROGRESS_WIDGET_DIMENSIONS = Object.freeze({
  desktop: { width: 390, height: 450 },
  mobile: { width: 330, height: 450 },
});

export interface MissionDefinition {
  id: string;
  title: string;
  mapNames: string[];
  steps: string[];
}

interface MissionRecord {
  completed?: boolean;
  completedSteps?: string[];
  title?: string;
  totalSteps?: number;
}

interface MissionProgressState {
  activeMissionId?: string;
  missions?: Record<string, MissionRecord>;
}

interface MissionProgressStorage extends Record<string, unknown> {
  missionProgress?: MissionProgressState;
}

interface MissionProgressSnapshot {
  completed: number;
  completedMission: boolean;
  missionId: string;
  percent: number;
  title: string;
  total: number;
}

interface MissionProgressTrigger {
  completeMission: boolean;
  missionId: string;
  stepId?: string;
}

type MissionProgressPlayerTag = PlayerTagRecord & {
  missionProgressWidget?: ScriptWidget | null;
  missionProgressMapName?: string;
};

interface MissionProgressWidgetIncomingMessage {
  type?: string;
}

interface MissionProgressWidgetPayload {
  completed: number;
  completedMission: boolean;
  detail: string;
  missionId: string;
  museumButtonLabel: string;
  museumLockedMessage: string;
  museumUnlocked: boolean;
  nextStepLabel: string;
  percent: number;
  status: string;
  title: string;
  total: number;
}

interface MissionProgressWidgetOutgoingMessage {
  type: "mission-progress:init";
  payload: MissionProgressWidgetPayload;
}

const MISSION_TRIGGER_PREFIXES = ["mission:", "mp:"] as const;
const COMPLETE_STEP_ID = "complete";

const OVERALL_MISSION_IDS = Object.freeze([
  "anak-3",
  "muyongchong",
  "muryeong-tomb",
  "cheonmachong",
  "daeseongdong",
  "mirror-room",
]);

const OVERALL_MISSION_CLEAR_STEP_IDS: Record<string, string> = {
  "anak-3": "final-quiz",
  muyongchong: "final-quiz",
  "muryeong-tomb": "final-quiz",
  cheonmachong: "final-quiz",
  daeseongdong: "final-quiz",
  "mirror-room": "completion-screen",
};

export const MISSION_DEFINITIONS: MissionDefinition[] = [
  {
    id: "time-plaza",
    title: "시간 광장",
    mapNames: ["시간 광장"],
    steps: [
      "intro-dialog",
      "mission-board",
      "mirror-board",
      "tomb-portal",
      "mirror-room-unlock",
    ],
  },
  {
    id: "anak-3",
    title: "안악 3호분",
    mapNames: ["안악 3호분", "고구려 안악 3호분"],
    steps: [
      "npc-dialog",
      "kitchen-mural",
      "meat-storage-mural",
      "well-mural",
      "inner-room-unlock",
      "horse-handler-position",
      "final-quiz",
    ],
  },
  {
    id: "muyongchong",
    title: "무용총",
    mapNames: ["무용총", "고구려 무용총"],
    steps: [
      "npc-dialog",
      "hunting-mural",
      "archery-game",
      "dance-mural",
      "arrow-order-game",
      "guest-mural",
      "final-quiz",
    ],
  },
  {
    id: "muryeong-tomb",
    title: "무령왕릉",
    mapNames: ["무령왕릉", "백제 무령왕릉"],
    steps: [
      "npc-dialog",
      "epitaph",
      "bronze-mirror",
      "pine-coffin",
      "ebony-pillow",
      "exchange-region-game",
      "final-quiz",
    ],
  },
  {
    id: "cheonmachong",
    title: "천마총",
    mapNames: ["천마총", "신라 천마총"],
    steps: [
      "npc-dialog",
      "wooden-chamber",
      "stone-mound",
      "burial-mound",
      "build-order-quiz",
      "gold-accessory-game",
      "glass-cup",
      "final-quiz",
    ],
  },
  {
    id: "daeseongdong",
    title: "대성동 고분군",
    mapNames: ["대성동 고분군", "가야 대성동 고분군"],
    steps: [
      "npc-dialog",
      "iron-ore",
      "charcoal",
      "bellows",
      "furnace",
      "iron-process-game",
      "helmet",
      "sword",
      "horse-gear",
      "armor",
      "artifact-use-quiz",
      "trade-map",
      "final-quiz",
    ],
  },
  {
    id: "mirror-room",
    title: "거울의 방",
    mapNames: ["거울의 방"],
    steps: [
      "entry-check",
      "grandfather-dialog",
      "mirror-pieces",
      "review-popup",
      "exchange-map",
      "completion-screen",
    ],
  },
];

const MISSION_STEP_LABELS: Record<string, Record<string, string>> = {
  "time-plaza": {
    "intro-dialog": "안내자와 대화",
    "mission-board": "미션 게시판 확인",
    "mirror-board": "거울 조각 현황판 확인",
    "tomb-portal": "고분 입장",
    "mirror-room-unlock": "거울의 방 입장 조건 확인",
  },
  "anak-3": {
    "npc-dialog": "인물과 대화",
    "kitchen-mural": "부엌 벽화 확인",
    "meat-storage-mural": "고기창고 벽화 확인",
    "well-mural": "우물 벽화 확인",
    "inner-room-unlock": "안쪽 방 잠금 해제",
    "horse-handler-position": "마부 위치 찾기",
    "final-quiz": "최종 퀴즈 완료",
  },
  muyongchong: {
    "npc-dialog": "인물과 대화",
    "hunting-mural": "수렵도 확인",
    "archery-game": "활쏘기 게임 완료",
    "dance-mural": "무용도 확인",
    "arrow-order-game": "화살 순서 게임 완료",
    "guest-mural": "접객도 확인",
    "final-quiz": "최종 퀴즈 완료",
  },
  "muryeong-tomb": {
    "npc-dialog": "인물과 대화",
    epitaph: "지석 확인",
    "bronze-mirror": "청동거울 확인",
    "pine-coffin": "소나무 관 확인",
    "ebony-pillow": "두침 확인",
    "exchange-region-game": "교류 지역 게임 완료",
    "final-quiz": "최종 퀴즈 완료",
  },
  cheonmachong: {
    "npc-dialog": "인물과 대화",
    "wooden-chamber": "나무곽 확인",
    "stone-mound": "돌무지 확인",
    "burial-mound": "봉토 확인",
    "build-order-quiz": "축조 순서 퀴즈 완료",
    "gold-accessory-game": "금관 장식 게임 완료",
    "glass-cup": "유리잔 확인",
    "final-quiz": "최종 퀴즈 완료",
  },
  daeseongdong: {
    "npc-dialog": "인물과 대화",
    "iron-ore": "철광석 확인",
    charcoal: "숯 확인",
    bellows: "풀무 확인",
    furnace: "가마 확인",
    "iron-process-game": "철 생산 과정 게임 완료",
    helmet: "투구 확인",
    sword: "환두대도 확인",
    "horse-gear": "말갖춤 확인",
    armor: "갑옷 확인",
    "artifact-use-quiz": "유물 쓰임 퀴즈 완료",
    "trade-map": "교역 지도 확인",
    "final-quiz": "최종 퀴즈 완료",
  },
  "mirror-room": {
    "entry-check": "입장 조건 확인",
    "grandfather-dialog": "할아버지와 대화",
    "mirror-pieces": "청동거울 조각 확인",
    "review-popup": "복습 팝업 확인",
    "exchange-map": "교류 지도 확인",
    "completion-screen": "완료 화면 확인",
  },
};

function getStorage(player: ScriptPlayer): MissionProgressStorage {
  return loadPlayerStorage<MissionProgressStorage>(player, {
    missionProgress: { missions: {} },
  });
}

function getDefinitionById(missionId: string): MissionDefinition | null {
  return (
    MISSION_DEFINITIONS.find(function (definition) {
      return definition.id === missionId;
    }) ?? null
  );
}

function getDefinitionByMapName(mapName: string): MissionDefinition | null {
  const normalizedMapName = mapName.trim();
  if (!normalizedMapName) {
    return null;
  }

  return (
    MISSION_DEFINITIONS.find(function (definition) {
      return definition.mapNames.some(function (candidate) {
        return candidate === normalizedMapName;
      });
    }) ?? null
  );
}

function getStepLabel(missionId: string, stepId: string): string {
  return MISSION_STEP_LABELS[missionId]?.[stepId] ?? stepId;
}

function normalizeState(state: MissionProgressState | undefined): MissionProgressState {
  if (!state || typeof state !== "object") {
    return { missions: {} };
  }

  return {
    activeMissionId:
      typeof state.activeMissionId === "string" ? state.activeMissionId : undefined,
    missions:
      state.missions && typeof state.missions === "object" ? state.missions : {},
  };
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set<string>();
  values.forEach(function (value) {
    if (typeof value !== "string") {
      return;
    }

    const normalized = value.trim();
    if (normalized) {
      seen.add(normalized);
    }
  });

  return Array.from(seen);
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function resolveMissionId(
  state: MissionProgressState,
  mapName: string
): string {
  const mapDefinition = getDefinitionByMapName(mapName);
  if (mapDefinition) {
    return mapDefinition.id;
  }

  if (state.activeMissionId) {
    return state.activeMissionId;
  }

  return mapName.trim() || "unknown";
}

function getTotalSteps(
  definition: MissionDefinition | null,
  record: MissionRecord | undefined
): number {
  if (record && Number.isFinite(record.totalSteps) && (record.totalSteps as number) > 0) {
    return Math.floor(record.totalSteps as number);
  }

  return definition ? definition.steps.length : 0;
}

function hasCompletedEveryDefinedStep(
  missionId: string,
  record: MissionRecord | undefined
): boolean {
  const definition = getDefinitionById(missionId);
  if (!definition || definition.steps.length === 0) {
    return false;
  }

  const completedSteps = uniqueStrings(record?.completedSteps);
  return definition.steps.every(function (stepId) {
    return completedSteps.includes(stepId);
  });
}

function isOverallMissionClear(
  state: MissionProgressState,
  missionId: string
): boolean {
  const record = state.missions?.[missionId];
  if (record?.completed) {
    return true;
  }

  const completedSteps = uniqueStrings(record?.completedSteps);
  const clearStepId = OVERALL_MISSION_CLEAR_STEP_IDS[missionId];
  if (clearStepId && completedSteps.includes(clearStepId)) {
    return true;
  }

  return hasCompletedEveryDefinedStep(missionId, record);
}

function getOverallMissionProgress(
  player: ScriptPlayer
): MissionProgressSnapshot {
  const storage = getStorage(player);
  const state = normalizeState(storage.missionProgress);
  const total = OVERALL_MISSION_IDS.length;
  const completed = OVERALL_MISSION_IDS.filter(function (missionId) {
    return isOverallMissionClear(state, missionId);
  }).length;
  const percent = total > 0 ? clampPercent((completed / total) * 100) : 0;

  return {
    completed,
    completedMission: completed >= total,
    missionId: OVERALL_MISSION_ID,
    percent,
    title: OVERALL_MISSION_TITLE,
    total,
  };
}

function hasWatchedEndingVideo(player: ScriptPlayer): boolean {
  const storage = getStorage(player);
  const state = normalizeState(storage.missionProgress);
  return isOverallMissionClear(state, "mirror-room");
}

function buildProgressBar(percent: number): string {
  const filled = Math.round(percent / 10);
  return `[${"#".repeat(filled)}${"-".repeat(10 - filled)}]`;
}

function pickWidgetDimensions(player: ScriptPlayer): {
  width: number;
  height: number;
} {
  return player.isMobile
    ? MISSION_PROGRESS_WIDGET_DIMENSIONS.mobile
    : MISSION_PROGRESS_WIDGET_DIMENSIONS.desktop;
}

function getNextStepLabel(
  player: ScriptPlayer,
  progress: MissionProgressSnapshot
): string {
  if (progress.completedMission) {
    return "모든 단계 완료";
  }

  const definition = getDefinitionById(progress.missionId);
  if (!definition) {
    return "미션 기록 대기";
  }

  const storage = getStorage(player);
  const state = normalizeState(storage.missionProgress);
  const record = state.missions?.[progress.missionId];
  const completedSteps = uniqueStrings(record?.completedSteps);
  const nextStepId = definition.steps.find(function (stepId) {
    return !completedSteps.includes(stepId);
  });

  return nextStepId ? getStepLabel(progress.missionId, nextStepId) : "모든 단계 완료";
}

function buildWidgetPayload(
  player: ScriptPlayer,
  _mapName: string
): MissionProgressWidgetPayload {
  const progress = getOverallMissionProgress(player);
  const detail = `${progress.completed}/${progress.total}`;
  const status = progress.completedMission ? "미션 완료" : "진행 중";
  const museumUnlocked = hasWatchedEndingVideo(player);

  return {
    completed: progress.completed,
    completedMission: progress.completedMission,
    detail,
    missionId: progress.missionId,
    museumButtonLabel: MUSEUM_BUTTON_LABEL,
    museumLockedMessage: MUSEUM_LOCKED_MESSAGE,
    museumUnlocked,
    nextStepLabel: MUSEUM_BUTTON_LABEL,
    percent: progress.percent,
    status,
    title: progress.title,
    total: progress.total,
  };
}

function sendProgressToWidget(
  widget: ScriptWidget | null | undefined,
  payload: MissionProgressWidgetPayload
): void {
  if (!widget || typeof widget.sendMessage !== "function") {
    return;
  }

  const message: MissionProgressWidgetOutgoingMessage = {
    type: "mission-progress:init",
    payload,
  };

  widget.sendMessage(message);
}

function teardownMissionProgressWidget(tag: MissionProgressPlayerTag): void {
  const existing = tag.missionProgressWidget;
  tag.missionProgressWidget = null;
  tag.missionProgressMapName = undefined;

  if (existing && typeof existing.destroy === "function") {
    existing.destroy();
  }
}

function stripTriggerOptions(raw: string): string {
  const [trigger] = raw.split("|");
  return (trigger ?? "").trim();
}

function parseMissionTrigger(
  raw: unknown,
  mapName: string
): MissionProgressTrigger | null {
  if (typeof raw !== "string") {
    return null;
  }

  const normalized = stripTriggerOptions(raw);
  if (!normalized) {
    return null;
  }

  let body = "";
  const matchedPrefix = MISSION_TRIGGER_PREFIXES.find(function (prefix) {
    return normalized.startsWith(prefix);
  });

  if (!matchedPrefix) {
    return null;
  }

  body = normalized.slice(matchedPrefix.length).trim();
  if (!body) {
    return null;
  }

  const parts = body
    .split(":")
    .map(function (part) {
      return part.trim();
    })
    .filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  let missionId = "";
  let stepId = "";

  if (parts.length === 1) {
    const definition = getDefinitionByMapName(mapName);
    if (!definition) {
      return null;
    }

    missionId = definition.id;
    stepId = parts[0] ?? "";
  } else {
    missionId = parts[0] ?? "";
    stepId = parts[1] ?? "";
  }

  const completeMission = stepId === COMPLETE_STEP_ID;
  const definition = getDefinitionById(missionId);

  if (!missionId || !stepId) {
    return null;
  }

  if (!completeMission && definition && !definition.steps.includes(stepId)) {
    return null;
  }

  return {
    completeMission,
    missionId,
    stepId: completeMission ? undefined : stepId,
  };
}

function showMissionStepFeedback(
  player: ScriptPlayer,
  progress: MissionProgressSnapshot,
  stepId: string
): void {
  const stepLabel = getStepLabel(progress.missionId, stepId);
  const overallProgress = getOverallMissionProgress(player);
  const message = [
    `${progress.title}`,
    `${stepLabel} 완료`,
    `전체 진행률 ${overallProgress.percent}% ${buildProgressBar(overallProgress.percent)}`,
    `${overallProgress.completed}/${overallProgress.total} 미션 완료`,
  ].join("\n");

  player.showCustomLabel(
    message,
    0xffffff,
    0x000000,
    0,
    player.isMobile ? 60 : 52,
    0.68,
    3500,
    {
      borderRadius: "8px",
      padding: "6px",
    }
  );
  player.sendUpdated();
}

function showMissionCompleteFeedback(
  player: ScriptPlayer,
  progress: MissionProgressSnapshot
): void {
  const overallProgress = getOverallMissionProgress(player);
  const message = [
    `${progress.title}`,
    "미션 완료",
    `전체 진행률 ${overallProgress.percent}% ${buildProgressBar(overallProgress.percent)}`,
    `${overallProgress.completed}/${overallProgress.total} 미션 완료`,
  ].join("\n");

  player.showCustomLabel(
    message,
    0xffffff,
    0x000000,
    0,
    player.isMobile ? 60 : 52,
    0.72,
    4000,
    {
      borderRadius: "8px",
      padding: "6px",
    }
  );
  player.sendUpdated();
}

function addMissionLocationTrigger(locationName: string): void {
  if (registeredMissionProgressLocationNames.has(locationName)) {
    return;
  }

  registeredMissionProgressLocationNames.add(locationName);
  ScriptApp.addOnLocationEnter(locationName, function (player: ScriptPlayer) {
    handleMissionProgressTrigger(player, locationName, ScriptMap.name);
  });
  ScriptApp.addOnLocationTouched(locationName, function (player: ScriptPlayer) {
    handleMissionProgressTrigger(player, locationName, ScriptMap.name);
  });
}

export function handleNearbyMissionProgressLocation(
  player: ScriptPlayer,
  mapName: string,
  radius = 1
): boolean {
  const locationName = findNearbyLocationName(
    player,
    registeredMissionProgressLocationNames,
    radius
  );

  return locationName
    ? handleMissionProgressTrigger(player, locationName, mapName)
    : false;
}

export function getMissionProgress(
  player: ScriptPlayer,
  mapName: string
): MissionProgressSnapshot {
  const storage = getStorage(player);
  const state = normalizeState(storage.missionProgress);
  const missionId = resolveMissionId(state, mapName);
  const definition = getDefinitionById(missionId);
  const record = state.missions?.[missionId];
  const total = getTotalSteps(definition, record);
  const completedSteps = uniqueStrings(record?.completedSteps);
  const completedMission = Boolean(record?.completed);
  const completed = completedMission && total > 0
    ? total
    : Math.min(completedSteps.length, total);
  const percent = total > 0 ? clampPercent((completed / total) * 100) : 0;

  return {
    completed,
    completedMission,
    missionId,
    percent,
    title: record?.title ?? definition?.title ?? mapName.trim() ?? "현재 미션",
    total,
  };
}

export function isMissionStepComplete(
  player: ScriptPlayer,
  missionId: string,
  stepId: string
): boolean {
  const storage = getStorage(player);
  const state = normalizeState(storage.missionProgress);
  const record = state.missions?.[missionId];
  return uniqueStrings(record?.completedSteps).includes(stepId.trim());
}

export function isMissionComplete(
  player: ScriptPlayer,
  missionId: string
): boolean {
  const storage = getStorage(player);
  const state = normalizeState(storage.missionProgress);
  const record = state.missions?.[missionId];
  return Boolean(record?.completed);
}

export function markMissionStepComplete(
  player: ScriptPlayer,
  missionId: string,
  stepId: string
): MissionProgressSnapshot {
  const storage = getStorage(player);
  const state = normalizeState(storage.missionProgress);
  const definition = getDefinitionById(missionId);
  const record = state.missions?.[missionId] ?? {};
  const completedSteps = uniqueStrings(record.completedSteps);
  const normalizedStepId = stepId.trim();

  if (normalizedStepId && !completedSteps.includes(normalizedStepId)) {
    completedSteps.push(normalizedStepId);
  }

  const total = getTotalSteps(definition, record);
  const nextRecord: MissionRecord = {
    ...record,
    completed: total > 0 && completedSteps.length >= total,
    completedSteps,
    title: record.title ?? definition?.title,
    totalSteps: record.totalSteps,
  };

  const nextState: MissionProgressState = {
    activeMissionId: missionId,
    missions: {
      ...(state.missions ?? {}),
      [missionId]: nextRecord,
    },
  };

  savePlayerStorage(
    player,
    {
      ...storage,
      [STORAGE_KEY]: nextState,
    },
    { persist: true }
  );

  return getMissionProgress(player, definition?.mapNames[0] ?? missionId);
}

export function completeMission(
  player: ScriptPlayer,
  missionId: string
): MissionProgressSnapshot {
  const storage = getStorage(player);
  const state = normalizeState(storage.missionProgress);
  const definition = getDefinitionById(missionId);
  const record = state.missions?.[missionId] ?? {};
  const completedSteps = definition ? [...definition.steps] : uniqueStrings(record.completedSteps);

  const nextState: MissionProgressState = {
    activeMissionId: missionId,
    missions: {
      ...(state.missions ?? {}),
      [missionId]: {
        ...record,
        completed: true,
        completedSteps,
        title: record.title ?? definition?.title,
        totalSteps: record.totalSteps,
      },
    },
  };

  savePlayerStorage(
    player,
    {
      ...storage,
      [STORAGE_KEY]: nextState,
    },
    { persist: true }
  );

  return getMissionProgress(player, definition?.mapNames[0] ?? missionId);
}

export function resetMissionProgress(
  player: ScriptPlayer,
  missionId?: string
): void {
  const storage = getStorage(player);
  const state = normalizeState(storage.missionProgress);

  if (missionId?.trim()) {
    const normalizedMissionId = missionId.trim();
    const missions = { ...(state.missions ?? {}) };
    delete missions[normalizedMissionId];

    savePlayerStorage(
      player,
      {
        ...storage,
        [STORAGE_KEY]: {
          ...state,
          activeMissionId:
            state.activeMissionId === normalizedMissionId
              ? undefined
              : state.activeMissionId,
          missions,
        },
      },
      { persist: true }
    );
    return;
  }

  savePlayerStorage(
    player,
    {
      ...storage,
      [STORAGE_KEY]: { missions: {} },
    },
    { persist: true }
  );
}

function showMuseumLockedMessage(player: ScriptPlayer): void {
  player.showCenterLabel(
    MUSEUM_LOCKED_MESSAGE,
    0xffffff,
    0x000000,
    420,
    3000
  );
  player.sendUpdated();
}

function openNationalMuseum(player: ScriptPlayer): void {
  if (!hasWatchedEndingVideo(player)) {
    showMuseumLockedMessage(player);
    return;
  }

  player.spawnAtMap(
    NATIONAL_MUSEUM_SPACE_HASH_ID,
    NATIONAL_MUSEUM_ENTRY_MAP_HASH_ID
  );
}

export function handleMissionProgressTrigger(
  player: ScriptPlayer,
  rawTrigger: unknown,
  mapName: string
): boolean {
  const trigger = parseMissionTrigger(rawTrigger, mapName);
  if (!trigger) {
    return false;
  }

  if (trigger.completeMission) {
    const alreadyComplete = isMissionComplete(player, trigger.missionId);
    const progress = completeMission(player, trigger.missionId);

    if (!alreadyComplete) {
      showMissionCompleteFeedback(player, progress);
    }

    return true;
  }

  const stepId = trigger.stepId ?? "";
  const alreadyComplete = isMissionStepComplete(
    player,
    trigger.missionId,
    stepId
  );
  const progress = markMissionStepComplete(player, trigger.missionId, stepId);

  if (!alreadyComplete) {
    showMissionStepFeedback(player, progress, stepId);
  }

  return true;
}

export function handleMissionProgressObjectKey(
  player: ScriptPlayer,
  key: unknown,
  mapName: string
): boolean {
  return handleMissionProgressTrigger(player, key, mapName);
}

export function registerMissionProgressLocations(): void {
  const locationNames = new Set<string>();

  MISSION_DEFINITIONS.forEach(function (definition) {
    MISSION_TRIGGER_PREFIXES.forEach(function (prefix) {
      locationNames.add(`${prefix}${definition.id}:${COMPLETE_STEP_ID}`);

      definition.steps.forEach(function (stepId) {
        locationNames.add(`${prefix}${definition.id}:${stepId}`);
        locationNames.add(`${prefix}${stepId}`);
      });
    });
  });

  MISSION_TRIGGER_PREFIXES.forEach(function (prefix) {
    locationNames.add(`${prefix}${COMPLETE_STEP_ID}`);
  });

  locationNames.forEach(addMissionLocationTrigger);
}

export function showMissionProgress(
  player: ScriptPlayer,
  mapName: string
): void {
  const tag = preparePlayerTag(player) as MissionProgressPlayerTag;
  const payload = buildWidgetPayload(player, mapName);

  if (tag.missionProgressWidget) {
    tag.missionProgressMapName = mapName;
    sendProgressToWidget(tag.missionProgressWidget, payload);
    return;
  }

  const { width, height } = pickWidgetDimensions(player);
  const widget = player.showWidget(
    MISSION_PROGRESS_WIDGET_TEMPLATE,
    "middle",
    width,
    height
  );

  tag.missionProgressWidget = widget;
  tag.missionProgressMapName = mapName;

  widget.onMessage.Add(function (_sender, data) {
    const type = (data as MissionProgressWidgetIncomingMessage | undefined)?.type;

    if (type === "mission-progress:close") {
      teardownMissionProgressWidget(tag);
      return;
    }

    if (type === "mission-progress:ready") {
      const currentMapName = tag.missionProgressMapName ?? mapName;
      sendProgressToWidget(widget, buildWidgetPayload(player, currentMapName));
      return;
    }

    if (type === "mission-progress:open-museum") {
      openNationalMuseum(player);
    }
  });

  sendProgressToWidget(widget, payload);
}
