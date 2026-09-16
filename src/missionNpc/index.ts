import type { ScriptPlayer, ScriptWidget } from "zep-script";
import { handleMuseumAction, closeMuseumGame, handleMuseumDialogueChoice } from "../nationalMuseum/gameplay";
import { resolveMuseumSceneId } from "../nationalMuseum/exploration";

import {
  NATIONAL_MUSEUM_NPCS,
  NATIONAL_MUSEUM_NPC_ALIASES,
  NATIONAL_MUSEUM_SCENE_ALIASES,
} from "../nationalMuseum/npcs";
import { handleMissionGameTrigger } from "../missionGame";
import { addInventoryItem, refreshInventoryWidget } from "../inventory";
import type { InventoryItem } from "../inventory/interfaces";
import {
  isMissionStepComplete,
  markMissionStepComplete,
  showMissionProgress,
} from "../missionProgress";
import { findNearbyLocationName } from "../utils/location";
import {
  type PlayerStorageRecord,
  type PlayerTagRecord,
  loadPlayerStorage,
  preparePlayerTag,
  savePlayerStorage,
} from "../utils/player";

const MISSION_NPC_WIDGET_TEMPLATE = "html/mission-npc-widget-v17.html";
const MUSEUM_NPC_WIDGET_TEMPLATE = "html/museum-npc-widget-v1.html";

const MISSION_NPC_WIDGET_DIMENSIONS = Object.freeze({
  desktop: { width: 1020, height: 660 },
  mobile: { width: 340, height: 440 },
});
const MISSION_NPC_ADVANCE_DEDUP_MS = 160;
const MISSION_NPC_READY_RETRY_MS = 1100;

const NPC_TRIGGER_PREFIXES = ["npc:", "dialog:"] as const;
const DEFAULT_SCENE_ID = "intro";
const NPC_PROFILE_IMAGE_BASE_URL =
  "https://rid.gcdn.ntruss.com/zep-script/seoul_2/npc";
const DEFAULT_PLAYER_MOVE_SPEED = 80;
const registeredMissionNpcLocationNames = new Set<string>();
const DAESEONGDONG_IRON_ITEM_STEP_IDS = [
  "iron-ore",
  "charcoal",
  "bellows",
  "furnace",
];
const DAESEONGDONG_ARTIFACT_STEP_IDS = [
  "helmet",
  "sword",
  "horse-gear",
  "armor",
];

const NPC_ID_ALIASES: Record<string, string> = {
  ...NATIONAL_MUSEUM_NPC_ALIASES,
  ending: "time-grandfather",
  "시간할아버지": "time-grandfather",
  timegrandfather: "time-grandfather",
  eulssi: "eulssi",
  godu: "godu",
  "고두": "godu",
  dancer: "dancer",
  muhi: "dancer",
  jinmyosu: "jinmyosu",
  seoki: "seoki",
  gwanghoek: "gwanghoek",
  gwanghyeok: "gwanghoek",
  gwanghwek: "gwanghoek",
  gwanghyuk: "gwanghoek",
  gwanghyeog: "gwanghoek",
  kwanghoek: "gwanghoek",
  kwanghyeok: "gwanghoek",
  kwanghyuk: "gwanghoek",
  gwanghoeg: "gwanghoek",
  gwanghoik: "gwanghoek",
  "광획": "gwanghoek",
  "광혁": "gwanghoek",
  "진묘수": "jinmyosu",
  "석수진묘수": "jinmyosu",
  "석수-진묘수": "jinmyosu",
  "석이": "seoki",
  "을씨": "eulssi",
  "무희": "dancer",
  "무희npc": "dancer",
};

const NPC_SCENE_ALIASES: Record<string, Record<string, string>> = {
  ...NATIONAL_MUSEUM_SCENE_ALIASES,
  "time-grandfather": {
    "1": "ending",
    "trigger1": "ending",
    "trigger-1": "ending",
    "트리거1": "ending",
    "엔딩": "ending",
    ending: "ending",
    "거울의방": "ending",
    "거울의방입장": "ending",
    "2": "portal-blue-1",
    "trigger2": "portal-blue-1",
    "trigger-2": "portal-blue-1",
    "트리거2": "portal-blue-1",
    "파란색포탈": "portal-blue-1",
    "파란포탈": "portal-blue-1",
    "portalblue1": "portal-blue-1",
    "portal-blue-1": "portal-blue-1",
    "3": "portal-pink",
    "trigger3": "portal-pink",
    "trigger-3": "portal-pink",
    "트리거3": "portal-pink",
    "분홍색포탈": "portal-pink",
    "분홍포탈": "portal-pink",
    "portalpink": "portal-pink",
    "portal-pink": "portal-pink",
    "4": "portal-purple",
    "trigger4": "portal-purple",
    "trigger-4": "portal-purple",
    "트리거4": "portal-purple",
    "보라색포탈": "portal-purple",
    "보라포탈": "portal-purple",
    "portalpurple": "portal-purple",
    "portal-purple": "portal-purple",
    "5": "portal-blue-2",
    "trigger5": "portal-blue-2",
    "trigger-5": "portal-blue-2",
    "트리거5": "portal-blue-2",
    "파란색포탈2": "portal-blue-2",
    "파란포탈2": "portal-blue-2",
    "portalblue2": "portal-blue-2",
    "portal-blue-2": "portal-blue-2",
    "6": "portal-yellow",
    "trigger6": "portal-yellow",
    "trigger-6": "portal-yellow",
    "트리거6": "portal-yellow",
    "노란색포탈": "portal-yellow",
    "노란포탈": "portal-yellow",
    "portalyellow": "portal-yellow",
    "portal-yellow": "portal-yellow",
  },
  eulssi: {
    "1": "intro",
    "trigger1": "intro",
    "trigger-1": "intro",
    "트리거1": "intro",
    "을씨트리거1": "intro",
    "2": "kitchen",
    "trigger2": "kitchen",
    "trigger-2": "kitchen",
    "트리거2": "kitchen",
    "을씨트리거2": "kitchen",
    "부엌": "kitchen",
    "3": "meat-storage",
    "trigger3": "meat-storage",
    "trigger-3": "meat-storage",
    "트리거3": "meat-storage",
    "을씨트리거3": "meat-storage",
    "고기창고": "meat-storage",
    "4": "well",
    "trigger4": "well",
    "trigger-4": "well",
    "트리거4": "well",
    "을씨트리거4": "well",
    "우물": "well",
    "5": "inner-room",
    "trigger5": "inner-room",
    "trigger-5": "inner-room",
    "트리거5": "inner-room",
    "을씨트리거5": "inner-room",
    "대행렬도": "inner-room",
    "자리찾기": "inner-room",
    "오답": "wrong-seat",
    "wrong": "wrong-seat",
    "wrongseat": "wrong-seat",
    "wrong-seat": "wrong-seat",
    "정답": "correct-seat",
    "correct": "correct-seat",
    "correctseat": "correct-seat",
    "correct-seat": "correct-seat",
    "quiz": "final-quiz",
    "finalquiz": "final-quiz",
    "final-quiz": "final-quiz",
    "퀴즈": "final-quiz",
    "최종퀴즈": "final-quiz",
    "trigger5quiz": "final-quiz",
    "trigger-5-quiz": "final-quiz",
    "6": "reward",
    "trigger6": "reward",
    "trigger-6": "reward",
    "트리거6": "reward",
    "을씨트리거6": "reward",
    "보상": "reward",
    "ending": "ending-review",
    "endingreview": "ending-review",
    "ending-review": "ending-review",
    "정리": "ending-review",
  },
  godu: {
    "1": "intro",
    "trigger1": "intro",
    "trigger-1": "intro",
    "트리거1": "intro",
    "고두트리거1": "intro",
    "널방진입": "intro",
    "첫만남": "intro",
    "2": "dance-floor",
    "trigger2": "dance-floor",
    "trigger-2": "dance-floor",
    "트리거2": "dance-floor",
    "고두트리거2": "dance-floor",
    "무용도": "dance-floor",
    "춤발판": "dance-floor",
    "dance": "dance-floor",
    "dancefloor": "dance-floor",
    "dance-floor": "dance-floor",
    "3": "reception-hint",
    "trigger3": "reception-hint",
    "trigger-3": "reception-hint",
    "트리거3": "reception-hint",
    "고두트리거3": "reception-hint",
    "접객도": "reception-hint",
    "힌트": "reception-hint",
    "reception": "reception-hint",
    "receptionhint": "reception-hint",
    "reception-hint": "reception-hint",
    "quiz": "final-quiz",
    "finalquiz": "final-quiz",
    "final-quiz": "final-quiz",
    "퀴즈": "final-quiz",
    "최종퀴즈": "final-quiz",
    "4": "reward",
    "trigger4": "reward",
    "trigger-4": "reward",
    "트리거4": "reward",
    "고두트리거4": "reward",
    "보상": "reward",
    "5": "dancer-guide",
    "trigger5": "dancer-guide",
    "trigger-5": "dancer-guide",
    "트리거5": "dancer-guide",
    "고두트리거5": "dancer-guide",
    "무희안내": "dancer-guide",
    "벽화안내": "dancer-guide",
    "dancerguide": "dancer-guide",
    "dancer-guide": "dancer-guide",
    "hunting": "hunting-game",
    "huntinggame": "hunting-game",
    "hunting-game": "hunting-game",
    "활쏘기": "hunting-game",
    "archery": "hunting-game",
    "archerygame": "hunting-game",
    "archery-game": "hunting-game",
  },
  jinmyosu: {
    "1": "entrance-toast",
    "trigger1": "entrance-toast",
    "trigger-1": "entrance-toast",
    "트리거1": "entrance-toast",
    "토스트": "entrance-toast",
    "toast": "entrance-toast",
    "2": "entrance-camera",
    "trigger2": "entrance-camera",
    "trigger-2": "entrance-camera",
    "트리거2": "entrance-camera",
    "카메라": "entrance-camera",
    "camera": "entrance-camera",
    "3": "brick-tomb-guide",
    "trigger3": "brick-tomb-guide",
    "trigger-3": "brick-tomb-guide",
    "트리거3": "brick-tomb-guide",
    "벽돌무덤": "brick-tomb-guide",
    "벽돌무덤안내": "brick-tomb-guide",
    "brick": "brick-tomb-guide",
    "brick-tomb-guide": "brick-tomb-guide",
    "4": "first-meeting",
    "trigger4": "first-meeting",
    "trigger-4": "first-meeting",
    "트리거4": "first-meeting",
    "첫만남": "first-meeting",
    "널방진입": "first-meeting",
    "진묘수첫만남": "first-meeting",
    "firstmeeting": "first-meeting",
    "first-meeting": "first-meeting",
    "5": "burial-goods-guide",
    "trigger5": "burial-goods-guide",
    "trigger-5": "burial-goods-guide",
    "트리거5": "burial-goods-guide",
    "부장품안내": "burial-goods-guide",
    "교류안내": "burial-goods-guide",
    "burialgoodsguide": "burial-goods-guide",
    "burial-goods-guide": "burial-goods-guide",
    "3-1": "bronze-mirror",
    "31": "bronze-mirror",
    "trigger3-1": "bronze-mirror",
    "trigger-3-1": "bronze-mirror",
    "트리거3-1": "bronze-mirror",
    "청동거울": "bronze-mirror",
    "bronze": "bronze-mirror",
    "bronze-mirror": "bronze-mirror",
    "3-2": "pine-coffin",
    "32": "pine-coffin",
    "trigger3-2": "pine-coffin",
    "trigger-3-2": "pine-coffin",
    "트리거3-2": "pine-coffin",
    "금송": "pine-coffin",
    "금송목관": "pine-coffin",
    "금송목관조각": "pine-coffin",
    "pine": "pine-coffin",
    "pine-coffin": "pine-coffin",
    "3-3": "ebony-pillow",
    "33": "ebony-pillow",
    "trigger3-3": "ebony-pillow",
    "trigger-3-3": "ebony-pillow",
    "트리거3-3": "ebony-pillow",
    "흑단": "ebony-pillow",
    "흑단두침": "ebony-pillow",
    "ebony": "ebony-pillow",
    "ebony-pillow": "ebony-pillow",
    "3-4": "exchange-map",
    "34": "exchange-map",
    "trigger3-4": "exchange-map",
    "trigger-3-4": "exchange-map",
    "트리거3-4": "exchange-map",
    "교류지도": "exchange-map",
    "부장품교류지도": "exchange-map",
    "exchange": "exchange-map",
    "exchange-map": "exchange-map",
    "map": "exchange-map",
    "wrong": "exchange-wrong",
    "exchange-wrong": "exchange-wrong",
    "오답": "exchange-wrong",
    "correct": "exchange-correct",
    "exchange-correct": "exchange-correct",
    "정답": "exchange-correct",
    "quiz": "final-quiz",
    "finalquiz": "final-quiz",
    "final-quiz": "final-quiz",
    "퀴즈": "final-quiz",
    "6": "final-quiz",
    "trigger6": "final-quiz",
    "trigger-6": "final-quiz",
    "트리거6": "final-quiz",
    "최종퀴즈": "final-quiz",
    "7": "reward",
    "trigger7": "reward",
    "trigger-7": "reward",
    "트리거7": "reward",
    "보상": "reward",
    "정리": "reward",
  },
  seoki: {
    "1": "intro",
    "trigger1": "intro",
    "trigger-1": "intro",
    "트리거1": "intro",
    "석이트리거1": "intro",
    "첫만남": "intro",
    "축조현장": "intro",
    "2": "wooden-chamber",
    "trigger2": "wooden-chamber",
    "trigger-2": "wooden-chamber",
    "트리거2": "wooden-chamber",
    "석이트리거2": "wooden-chamber",
    "단면": "wooden-chamber",
    "구조": "wooden-chamber",
    "structure": "wooden-chamber",
    "wooden": "wooden-chamber",
    "woodenchamber": "wooden-chamber",
    "wooden-chamber": "wooden-chamber",
    "chamber": "wooden-chamber",
    "덧널": "wooden-chamber",
    "나무덧널": "wooden-chamber",
    "나무곽": "wooden-chamber",
    "1번": "wooden-chamber",
    "구조1": "wooden-chamber",
    "단면1": "wooden-chamber",
    "2-1": "stone-mound",
    "21": "stone-mound",
    "trigger2-1": "stone-mound",
    "trigger-2-1": "stone-mound",
    "트리거2-1": "stone-mound",
    "석이트리거2-1": "stone-mound",
    "stone": "stone-mound",
    "stonemound": "stone-mound",
    "stone-mound": "stone-mound",
    "돌무지": "stone-mound",
    "2번": "stone-mound",
    "구조2": "stone-mound",
    "단면2": "stone-mound",
    "2-2": "burial-mound",
    "22": "burial-mound",
    "trigger2-2": "burial-mound",
    "trigger-2-2": "burial-mound",
    "트리거2-2": "burial-mound",
    "석이트리거2-2": "burial-mound",
    "2-3": "burial-mound",
    "23": "burial-mound",
    "trigger2-3": "burial-mound",
    "trigger-2-3": "burial-mound",
    "트리거2-3": "burial-mound",
    "석이트리거2-3": "burial-mound",
    "burial": "burial-mound",
    "burialmound": "burial-mound",
    "burial-mound": "burial-mound",
    "mound": "burial-mound",
    "봉토": "burial-mound",
    "봉분": "burial-mound",
    "3번": "burial-mound",
    "구조3": "burial-mound",
    "단면3": "burial-mound",
    "3": "costume",
    "trigger3": "costume",
    "trigger-3": "costume",
    "트리거3": "costume",
    "석이트리거3": "costume",
    "복식": "costume",
    "복식복원": "costume",
    "금관": "costume",
    "4": "final-quiz",
    "trigger4": "final-quiz",
    "trigger-4": "final-quiz",
    "트리거4": "final-quiz",
    "석이트리거4": "final-quiz",
    "유리잔": "final-quiz",
    "서역계유리잔": "final-quiz",
    "quiz": "final-quiz",
    "finalquiz": "final-quiz",
    "final-quiz": "final-quiz",
    "퀴즈": "final-quiz",
    "최종퀴즈": "final-quiz",
    "5": "reward",
    "trigger5": "reward",
    "trigger-5": "reward",
    "트리거5": "reward",
    "석이트리거5": "reward",
    "보상": "reward",
    "정리": "reward",
  },
  gwanghoek: {
    "1": "intro",
    "trigger1": "intro",
    "trigger-1": "intro",
    "트리거1": "intro",
    "광획트리거1": "intro",
    "첫만남": "intro",
    "장인촌": "intro",
    "help": "intro-help",
    "introhelp": "intro-help",
    "intro-help": "intro-help",
    "제련설명": "intro-help",
    "1-1": "iron-ore",
    "11": "iron-ore",
    "trigger1-1": "iron-ore",
    "trigger-1-1": "iron-ore",
    "트리거1-1": "iron-ore",
    "철광석": "iron-ore",
    "철광석찾기": "iron-ore",
    "ironore": "iron-ore",
    "iron-ore": "iron-ore",
    "1-2": "charcoal",
    "12": "charcoal",
    "trigger1-2": "charcoal",
    "trigger-1-2": "charcoal",
    "트리거1-2": "charcoal",
    "숯": "charcoal",
    "숯찾기": "charcoal",
    "charcoal": "charcoal",
    "1-3": "bellows",
    "13": "bellows",
    "trigger1-3": "bellows",
    "trigger-1-3": "bellows",
    "트리거1-3": "bellows",
    "풀무": "bellows",
    "풀무찾기": "bellows",
    "bellows": "bellows",
    "1-4": "furnace",
    "14": "furnace",
    "trigger1-4": "furnace",
    "trigger-1-4": "furnace",
    "트리거1-4": "furnace",
    "제련로": "furnace",
    "제련로찾기": "furnace",
    "가마": "furnace",
    "furnace": "furnace",
    "2": "iron-production",
    "trigger2": "iron-production",
    "trigger-2": "iron-production",
    "트리거2": "iron-production",
    "철제련": "iron-production",
    "철생산": "iron-production",
    "ironproduction": "iron-production",
    "iron-production": "iron-production",
    "3": "artifact-match",
    "trigger3": "artifact-match",
    "trigger-3": "artifact-match",
    "트리거3": "artifact-match",
    "철제유물": "artifact-match",
    "유물짝짓기": "artifact-match",
    "artifactmatch": "artifact-match",
    "artifact-match": "artifact-match",
    "3-1": "helmet",
    "31": "helmet",
    "trigger3-1": "helmet",
    "trigger-3-1": "helmet",
    "트리거3-1": "helmet",
    "투구": "helmet",
    "투구찾기": "helmet",
    "helmet": "helmet",
    "artifact1": "helmet",
    "artifact-1": "helmet",
    "item1": "helmet",
    "item-1": "helmet",
    "유물1": "helmet",
    "3-2": "sword",
    "32": "sword",
    "trigger3-2": "sword",
    "trigger-3-2": "sword",
    "트리거3-2": "sword",
    "환두대도": "sword",
    "환두대도찾기": "sword",
    "큰칼": "sword",
    "sword": "sword",
    "artifact2": "sword",
    "artifact-2": "sword",
    "item2": "sword",
    "item-2": "sword",
    "유물2": "sword",
    "3-3": "horse-gear",
    "33": "horse-gear",
    "trigger3-3": "horse-gear",
    "trigger-3-3": "horse-gear",
    "트리거3-3": "horse-gear",
    "말갖춤": "horse-gear",
    "말갖춤찾기": "horse-gear",
    "말가춤": "horse-gear",
    "말가춤찾기": "horse-gear",
    "horsegear": "horse-gear",
    "horse-gear": "horse-gear",
    "artifact3": "horse-gear",
    "artifact-3": "horse-gear",
    "item3": "horse-gear",
    "item-3": "horse-gear",
    "유물3": "horse-gear",
    "3-4": "armor",
    "34": "armor",
    "trigger3-4": "armor",
    "trigger-3-4": "armor",
    "트리거3-4": "armor",
    "갑옷": "armor",
    "갑옷찾기": "armor",
    "armor": "armor",
    "artifact4": "armor",
    "artifact-4": "armor",
    "item4": "armor",
    "item-4": "armor",
    "유물4": "armor",
    "4": "trade-map-guide",
    "trigger4": "trade-map-guide",
    "trigger-4": "trade-map-guide",
    "트리거4": "trade-map-guide",
    "지도안내": "trade-map-guide",
    "5": "final-quiz",
    "trigger5": "final-quiz",
    "trigger-5": "final-quiz",
    "트리거5": "final-quiz",
    "quiz": "final-quiz",
    "finalquiz": "final-quiz",
    "final-quiz": "final-quiz",
    "퀴즈": "final-quiz",
    "최종퀴즈": "final-quiz",
    "6": "reward",
    "trigger6": "reward",
    "trigger-6": "reward",
    "트리거6": "reward",
    "보상": "reward",
    "정리": "reward",
  },
};

type MissionNpcRewardItem = InventoryItem;

type MissionNpcStorage = PlayerStorageRecord & {
  missionNpc?: {
    seenSceneKeys?: string[];
  };
};

interface MissionNpcScene {
  museumQuizId?: string;
  museumTransitionId?: string;
  id: string;
  title: string;
  lines: string[];
  afterRedirectDelayMs?: number;
  afterRedirectUrl?: string;
  afterMapTeleport?: {
    delayMs?: number;
    mapHashId: string;
    spaceHashId?: string;
  };
  autoCompleteFinalLineDelayMs?: number;
  choices?: MissionNpcChoice[];
  speakerlessLineTexts?: string[];
  displayName?: string;
  displayProfileImageUrl?: string;
  missionId?: string;
  stepId?: string;
  stepIds?: string[];
  afterTeleport?: {
    delayMs?: number;
    x: number;
    y: number;
  };
  afterGameTrigger?: string;
  afterShowMissionProgress?: boolean;
  afterGameRequiresSteps?: {
    message?: string;
    missionId: string;
    stepIds: string[];
  };
  afterNpcTrigger?: string;
  cameraFocus?: {
    durationMs?: number;
    moveDuration?: number;
    x: number;
    y: number;
  };
  nextAction?: string;
  oncePerPlayer?: boolean;
  preDialogueCameraFocus?: {
    durationMs?: number;
    lockMovement?: boolean;
    moveDuration?: number;
    x: number;
    y: number;
  };
  playerRole?: string;
  requiresCompletedSteps?: {
    message?: string;
    missionId: string;
    stepIds: string[];
  };
  rewardItems?: MissionNpcRewardItem[];
  skipWidget?: boolean;
  mediaOverlay?: MissionNpcMediaOverlay;
  speakerLines?: MissionNpcSpeakerLine[];
  toastMessage?: {
    durationMs?: number;
    text: string;
  };
}

interface MissionNpcMediaOverlay {
  autoAdvanceOnEnd?: boolean;
  lineIndex: number;
  title?: string;
  videoUrl: string;
}

interface MissionNpcSpeakerLine {
  profileImageUrl?: string;
  speakerName?: string;
  speakerless?: boolean;
  text: string;
}

interface MissionNpcChoice {
  museumQuizIndex?: number;
  id: string;
  label: string;
  lines: string[];
  speakerlessLineTexts?: string[];
  missionId?: string;
  stepId?: string;
  afterTeleport?: {
    delayMs?: number;
    x: number;
    y: number;
  };
  repeatOnComplete?: boolean;
}

interface MissionNpcDefinition {
  id: string;
  name: string;
  kind: "main" | "support" | "ending";
  mapNames: string[];
  profileImageUrl?: string;
  role: string;
  scenes: MissionNpcScene[];
}

type MissionNpcPlayerTag = PlayerTagRecord & {
  missionNpcJustCompletedAt?: number;
  missionNpcJustCompletedSceneId?: string;
  missionNpcJustCompletedStepId?: string;
  missionNpcWidget?: ScriptWidget | null;
  missionNpcWidgetTemplate?: string;
  missionNpcId?: string;
  missionNpcSceneId?: string;
  missionNpcPreDialogueCameraKey?: string;
  missionNpcPreDialogueCameraUntil?: number;
  missionNpcLastAdvanceAt?: number;
  missionNpcReadyAt?: number;
  missionNpcRetryCount?: number;
};

interface MissionNpcIncomingMessage {
  type?: "mission-npc:choice" | "mission-npc:close" | "mission-npc:complete" | "mission-npc:ready";
  choiceId?: string;
}

interface MissionNpcPayload {
  afterRedirectDelayMs?: number;
  afterRedirectUrl: string;
  autoCompleteFinalLineDelayMs?: number;
  choices: MissionNpcChoice[];
  kind: MissionNpcDefinition["kind"];
  lines: string[];
  mapNames: string[];
  name: string;
  nextAction: string;
  npcId: string;
  playerRole: string;
  profileImageUrl: string;
  mediaOverlay?: MissionNpcMediaOverlay;
  role: string;
  sceneId: string;
  speakerLines: MissionNpcSpeakerLine[];
  speakerlessLineTexts: string[];
  title: string;
}

interface MissionNpcInitMessage {
  type: "mission-npc:init";
  payload: MissionNpcPayload;
}

interface MissionNpcAdvanceMessage {
  type: "mission-npc:advance-request";
}

interface ParsedNpcTrigger {
  npcId: string;
  sceneId: string;
}

const MISSION_NPCS: MissionNpcDefinition[] = [
  ...NATIONAL_MUSEUM_NPCS,
  {
    id: "time-grandfather",
    name: "시간 할아버지",
    kind: "main",
    mapNames: ["시간 광장"],
    profileImageUrl: `${NPC_PROFILE_IMAGE_BASE_URL}/time-grandfather.png`,
    role: "세계관 안내, 전체 미션 목표, 고분 포털과 거울의 방 조건 설명",
    scenes: [
      {
        id: "intro",
        title: "시간 탐험의 시작",
        playerRole: "시간 탐험가",
        missionId: "time-plaza",
        stepId: "intro-dialog",
        nextAction: "미션 진행판과 청동거울 조각 현황판을 확인하세요.",
        speakerlessLineTexts: ["[[green:안악 3호분]]으로 이동해주세요."],
        lines: [
          "허허, 드디어 눈을 떴구나. 여기는 천 년 전 하늘이야.",
          "오늘부터 너는 씩씩한 '시간 탐험가'란다.",
          "옛 무덤 다섯 곳에서 거울 조각을 모아 오렴.",
          "다섯 조각이 다 모여야 집으로 돌아갈 수 있단다.",
        ],
        choices: [
          {
            id: "what-is-tomb",
            label: "고분이 뭐예요?",
            lines: [
              "고분은 옛날 사람들이 만든 아주 큰 무덤이야.",
              "죽어서도 살던 대로 지내길 바라며 지었단다.",
              "자, 이 '사후 세계 가방'을 네게 주마. 허허.",
              "무덤마다 함께 묻고 싶은 물건을 하나씩 담으렴.",
              "그리고 곰곰이 생각해 보렴. 왜 그 물건일까?",
              "자, 첫 번째 문이 열렸다. 잘 다녀오너라, 허허.",
              "[[green:안악 3호분]]으로 이동해주세요.",
            ],
            speakerlessLineTexts: ["[[green:안악 3호분]]으로 이동해주세요."],
          },
          {
            id: "start-now",
            label: "바로 출발할게요!",
            lines: [
              "무덤 속 그림과 물건에 옛이야기가 숨어 있지.",
              "자, 이 '사후 세계 가방'을 네게 주마. 허허.",
              "무덤마다 함께 묻고 싶은 물건을 하나씩 담으렴.",
              "그리고 곰곰이 생각해 보렴. 왜 그 물건일까?",
              "자, 첫 번째 문이 열렸다. 잘 다녀오너라, 허허.",
              "[[green:안악 3호분]]으로 이동해주세요.",
            ],
            speakerlessLineTexts: ["[[green:안악 3호분]]으로 이동해주세요."],
          },
        ],
        rewardItems: [
          {
            name: "사후 세계 가방",
            imageUrl: "../images/items/afterlife-bag.jpg",
            description: "무덤마다 함께 묻고 싶은 물건을 하나씩 담는 시간 탐험가의 가방입니다.",
            quantity: 1,
          },
        ],
      },
      {
        id: "afterlife-bag",
        title: "사후 세계 가방",
        playerRole: "시간 탐험가",
        missionId: "time-plaza",
        stepId: "mission-board",
        nextAction: "첫 번째 고분 문으로 이동하세요.",
        lines: [
          "자, 이 '사후 세계 가방'을 네게 주마. 허허.",
          "무덤마다 함께 묻고 싶은 물건을 하나씩 담으렴.",
          "그리고 곰곰이 생각해 보렴. 왜 그 물건일까?",
          "자, 첫 번째 문이 열렸다. 잘 다녀오너라, 허허.",
        ],
        rewardItems: [
          {
            name: "사후 세계 가방",
            imageUrl: "../images/items/afterlife-bag.jpg",
            description: "무덤마다 함께 묻고 싶은 물건을 하나씩 담는 시간 탐험가의 가방입니다.",
            quantity: 1,
          },
        ],
      },
      {
        id: "portal-blue-1",
        title: "파란색 포탈 안내",
        playerRole: "시간 탐험가",
        nextAction: "파란색 포탈로 이동하세요.",
        lines: [
          "[[blue:고구려 무용총]]으로 이동하렴.",
          "[[blue:고구려 무용총]]은 좌측 하단에 위치해있단다.",
        ],
      },
      {
        id: "portal-pink",
        title: "분홍색 포탈 안내",
        playerRole: "시간 탐험가",
        nextAction: "분홍색 포탈로 이동하세요.",
        lines: [
          "[[pink:백제 무령왕릉]]으로 이동하렴.",
          "[[pink:백제 무령왕릉]]은 좌측 상단에 위치해있단다.",
        ],
      },
      {
        id: "portal-purple",
        title: "보라색 포탈 안내",
        playerRole: "시간 탐험가",
        nextAction: "보라색 포탈로 이동하세요.",
        lines: [
          "[[purple:신라 천마총]]으로 이동하렴.",
          "[[purple:신라 천마총]]은 상단 중앙에 위치해있단다.",
        ],
      },
      {
        id: "portal-blue-2",
        title: "파란색 포탈 안내",
        playerRole: "시간 탐험가",
        nextAction: "파란색 포탈로 이동하세요.",
        lines: [
          "[[blue:가야 대성동 고분군]]으로 이동하렴.",
          "[[blue:가야 대성동 고분군]]은 상단 중앙에 위치해있단다.",
        ],
      },
      {
        id: "portal-yellow",
        title: "노란색 포탈 안내",
        playerRole: "시간 탐험가",
        nextAction: "노란색 포탈로 이동하세요.",
        lines: [
          "[[yellow:거울의 방]]으로 이동하렴.",
          "[[yellow:거울의 방]]은 우측 상단에 위치해있단다.",
        ],
      },
      {
        id: "ending",
        title: "거울의 방 재회",
        playerRole: "시간 탐험가",
        missionId: "mirror-room",
        stepIds: [
          "entry-check",
          "grandfather-dialog",
          "mirror-pieces",
          "review-popup",
          "exchange-map",
          "completion-screen",
        ],
        nextAction: "거울 조각 5개와 사후 세계 물건 5종, 미션 수행 결과를 확인하세요.",
        lines: [],
        mediaOverlay: {
          lineIndex: 8,
          videoUrl: "../videos/ending-mirror-room.mp4",
          title: "청동거울 완성",
          autoAdvanceOnEnd: true,
        },
        afterShowMissionProgress: true,
        speakerLines: [
          {
            speakerName: "시간 할아버지",
            profileImageUrl: `${NPC_PROFILE_IMAGE_BASE_URL}/time-grandfather.png`,
            text: "허허, 장하다! 잘 돌아왔구나, 탐험가.",
          },
          {
            speakerName: "시간 할아버지",
            profileImageUrl: `${NPC_PROFILE_IMAGE_BASE_URL}/time-grandfather.png`,
            text: "자, 이제 다섯 조각을 하나로 합쳐 보자꾸나.",
          },
          {
            speakerName: "을씨",
            profileImageUrl: `${NPC_PROFILE_IMAGE_BASE_URL}/eulssi.png`,
            text: "대행렬도엔 고구려의 신분 순서가 담겼지.",
          },
          {
            speakerName: "고두",
            profileImageUrl: `${NPC_PROFILE_IMAGE_BASE_URL}/godu.png`,
            text: "무용총은 고구려의 사냥·춤·불교를 보여 주지.",
          },
          {
            speakerName: "진묘수",
            profileImageUrl: `${NPC_PROFILE_IMAGE_BASE_URL}/jinmyosu.png`,
            text: "무령왕릉은 백제가 바다로 교류한 증거란다.",
          },
          {
            speakerName: "석이",
            profileImageUrl: `${NPC_PROFILE_IMAGE_BASE_URL}/seoki.png`,
            text: "천마총은 신라의 황금과 서역 교류를 말하지.",
          },
          {
            speakerName: "광획",
            profileImageUrl: `${NPC_PROFILE_IMAGE_BASE_URL}/gwanghoek.png`,
            text: "대성동 고분군은 가야의 철과 바다를 말하지!",
          },
          {
            speakerless: true,
            text: "다섯 조각이 하나의 청동거울로 합쳐지고, 방이 동아시아 지도로 바뀝니다.",
          },
          {
            speakerName: "시간 할아버지",
            profileImageUrl: `${NPC_PROFILE_IMAGE_BASE_URL}/time-grandfather.png`,
            text: "네가 모은 다섯 물건은 그때 사람들의 삶이란다.",
          },
          {
            speakerName: "시간 할아버지",
            profileImageUrl: `${NPC_PROFILE_IMAGE_BASE_URL}/time-grandfather.png`,
            text: "고분은 죽음의 공간이 아니란다.",
          },
          {
            speakerName: "시간 할아버지",
            profileImageUrl: `${NPC_PROFILE_IMAGE_BASE_URL}/time-grandfather.png`,
            text: "그 시대를 고스란히 담은 살아 있는 박물관이지.",
          },
          {
            speakerName: "시간 할아버지",
            profileImageUrl: `${NPC_PROFILE_IMAGE_BASE_URL}/time-grandfather.png`,
            text: "언젠가 또 다른 시대에서 다시 만나자꾸나.",
          },
        ],
      },
      {
        id: "ending-summary",
        title: "고분은 살아 있는 박물관",
        playerRole: "시간 탐험가",
        missionId: "mirror-room",
        stepId: "exchange-map",
        nextAction: "동아시아 지도와 다섯 물건을 함께 확인하세요.",
        lines: [
          "네가 모은 다섯 물건은 그때 사람들의 삶이란다.",
          "고분은 죽음의 공간이 아니란다.",
          "그 시대를 고스란히 담은 살아 있는 박물관이지.",
          "스스로 물어보렴. 나라면 무엇을, 왜 묻고 싶을까?",
        ],
      },
      {
        id: "ending-complete",
        title: "박물관 복귀",
        playerRole: "시간 탐험가",
        missionId: "mirror-room",
        stepId: "completion-screen",
        nextAction: "거울 조각 5개와 사후 세계 물건 5종을 요약하세요.",
        lines: [
          "언젠가 또 다른 시대에서 다시 만나자꾸나.",
        ],
      },
    ],
  },
  {
    id: "eulssi",
    name: "을씨",
    kind: "main",
    mapNames: ["안악 3호분", "고구려 안악 3호분"],
    profileImageUrl: `${NPC_PROFILE_IMAGE_BASE_URL}/eulssi.png`,
    role: "고구려 귀족 생활, 생활 벽화 탐색, 견마잡이 자리 찾기 미션 안내",
    scenes: [
      {
        id: "intro",
        title: "안악 3호분 안내",
        playerRole: "견마잡이 소년",
        missionId: "anak-3",
        stepId: "npc-dialog",
        nextAction: "부엌, 고기 창고, 우물 벽화를 차례로 확인하세요.",
        speakerlessLineTexts: ["부엌을 빠르게 살펴보자!"],
        lines: [
          "아이고 꼬마야, 왜 이리 늦었누!",
          "곧 큰 행차가 떠난단 말이다.",
          "안으로 얼른 이동하렴..",
          "그리고 벽에 그려진 부엌부터 확인해보렴.",
        ],
        choices: [
          {
            id: "inspect-kitchen",
            label: "네, 살펴볼게요!",
            lines: [
              "부엌을 빠르게 살펴보자!",
            ],
            speakerlessLineTexts: ["부엌을 빠르게 살펴보자!"],
          },
          {
            id: "what-is-parade",
            label: "행렬이 뭐예요?",
            lines: [
              "높은 분이 행차할 때 쭉 줄지어 따라가는 거야.",
              "부엌을 빠르게 살펴보자!",
            ],
            speakerlessLineTexts: ["부엌을 빠르게 살펴보자!"],
          },
        ],
      },
      {
        id: "intro-help",
        title: "행렬 설명",
        playerRole: "견마잡이 소년",
        nextAction: "선택지: ① 네, 살펴볼게요! ② 행렬이 뭐예요?",
        lines: [
          "높은 분이 행차할 때 쭉 줄지어 따라가는 거야.",
        ],
      },
      {
        id: "kitchen",
        title: "부엌 벽화",
        playerRole: "견마잡이 소년",
        missionId: "anak-3",
        stepId: "kitchen-mural",
        nextAction: "다음 벽화인 고기 창고를 확인하세요.",
        lines: [
          "저것 봐라, 시루에 떡을 찌고 있구나!",
          "고구려 사람도 떡이랑 고깃국을 즐겨 먹었단다.",
          "죽어서도 배불리 먹길 바라서 그린 거야.",
          "고기 창고도 한번 가보렴?",
        ],
      },
      {
        id: "meat-storage",
        title: "고기 창고 벽화",
        playerRole: "견마잡이 소년",
        missionId: "anak-3",
        stepId: "meat-storage-mural",
        nextAction: "다음 벽화인 우물을 확인하세요.",
        speakerlessLineTexts: ["우물이 보인다. 한번 가볼까?"],
        lines: [
          "창고에 고기가 주렁주렁 매달려 있지?",
          "귀족은 사냥과 가축으로 고기를 많이 얻었단다.",
          "우물이 보인다. 한번 가볼까?",
        ],
      },
      {
        id: "well",
        title: "우물 벽화",
        playerRole: "견마잡이 소년",
        missionId: "anak-3",
        stepId: "well-mural",
        nextAction: "대행렬도 구역으로 이동하세요.",
        speakerlessLineTexts: ["대행렬도를 찾아가보자."],
        lines: [
          "우물에 두레박이 걸린 게 보이지?",
          "이런 그림이 귀족의 넉넉한 살림을 보여 준단다.",
          "대행렬도를 찾아가보자.",
        ],
      },
      {
        id: "inner-room",
        title: "대행렬도 시작",
        playerRole: "견마잡이 소년",
        missionId: "anak-3",
        stepId: "inner-room-unlock",
        nextAction: "말고삐를 잡고 주인의 말 바로 앞에 서세요.",
        speakerlessLineTexts: ["말고삐를 잡고 주인의 말 바로 앞에 서세요!"],
        lines: [
          "자, 이제 큰 행렬 그림이 펼쳐졌다!",
          "250명이나 신분 순서대로 줄을 섰단다.",
          "너는 말고삐를 잡는 '견마잡이 소년'이야.",
          "말고삐를 잡고 주인의 말 바로 앞에 서세요!",
        ],
      },
      {
        id: "wrong-seat",
        title: "자리 찾기 오답",
        playerRole: "견마잡이 소년",
        nextAction: "주인의 말 바로 앞자리를 다시 찾으세요.",
        afterTeleport: {
          delayMs: 1000,
          x: 49,
          y: 53,
        },
        lines: [
          "예끼, 거기는 네 자리가 아니란다!",
        ],
      },
      {
        id: "correct-seat",
        title: "자리 찾기 정답",
        playerRole: "견마잡이 소년",
        missionId: "anak-3",
        stepId: "horse-handler-position",
        nextAction: "최종 퀴즈로 이동하세요.",
        afterNpcTrigger: "npc:eulssi:final-quiz",
        lines: [
          "옳지! 바로 거기가 네 자리다!",
        ],
      },
      {
        id: "final-quiz",
        title: "안악 3호분 최종 퀴즈",
        playerRole: "견마잡이 소년",
        nextAction: "선택지: ① 무사 ② 무덤 주인 ③ 노비",
        lines: [
          "이 그림에서 가장 크게 그려진 사람은 누구일까?",
        ],
        choices: [
          {
            id: "warrior",
            label: "무사",
            repeatOnComplete: true,
            lines: [
              "다시 보렴. 제일 크게 그린 사람을 찾는 거야.",
            ],
          },
          {
            id: "tomb-owner",
            label: "무덤 주인",
            missionId: "anak-3",
            stepId: "final-quiz",
            afterTeleport: {
              delayMs: 1000,
              x: 30,
              y: 35,
            },
            lines: [
              "그렇지! 높은 사람일수록 더 크게 그렸단다.",
              "이렇게 그리는 걸 '위계적 표현법'이라 해.",
              "그림 속 크기만 봐도 신분을 알 수 있지.",
            ],
          },
          {
            id: "servant",
            label: "노비",
            repeatOnComplete: true,
            lines: [
              "다시 보렴. 제일 크게 그린 사람을 찾는 거야.",
            ],
          },
        ],
      },
      {
        id: "final-quiz-correct",
        title: "퀴즈 정답",
        playerRole: "견마잡이 소년",
        missionId: "anak-3",
        stepId: "final-quiz",
        nextAction: "거울 조각과 시루떡 보상을 받으세요.",
        lines: [
          "그렇지! 높은 사람일수록 더 크게 그렸단다.",
          "이렇게 그리는 걸 '위계적 표현법'이라 해.",
          "그림 속 크기만 봐도 신분을 알 수 있지.",
        ],
      },
      {
        id: "final-quiz-wrong",
        title: "퀴즈 오답",
        playerRole: "견마잡이 소년",
        nextAction: "대행렬도에서 가장 크게 그려진 사람을 다시 찾으세요.",
        lines: [
          "다시 보렴. 제일 크게 그린 사람을 찾는 거야.",
        ],
      },
      {
        id: "reward",
        title: "안악 3호분 보상",
        playerRole: "견마잡이 소년",
        nextAction: "보상: 청동거울 조각 1번 + 시루떡",
        afterMapTeleport: {
          delayMs: 300,
          mapHashId: "M0JKQX",
        },
        autoCompleteFinalLineDelayMs: 1200,
        speakerlessLineTexts: [
          "이번 고분에서 알게 된 것은 고구려 귀족의 생활과 신분 질서입니다.",
          "왜 이런 벽화를 남겼는지 한번 곰곰히 생각해 봅시다!",
          "시간 광장으로 복귀합니다.",
        ],
        lines: [
          "잘했다, 탐험가! 거울 조각과 시루떡을 받으렴.",
          "이번 고분에서 알게 된 것은 고구려 귀족의 생활과 신분 질서입니다.",
          "왜 이런 벽화를 남겼는지 한번 곰곰히 생각해 봅시다!",
          "시간 광장으로 복귀합니다.",
        ],
        rewardItems: [
          {
            name: "청동거울 조각 ①번",
            imageUrl: "../images/items/bronze-mirror-fragment-1.jpg",
            description: "안악 3호분에서 획득한 첫 번째 청동거울 조각입니다.",
            quantity: 1,
          },
          {
            name: "시루떡",
            imageUrl: "../images/items/siru-rice-cake.jpg",
            description: "안악 3호분 부엌 벽화에서 떠올린 사후 세계 물건입니다.",
            quantity: 1,
          },
        ],
      },
      {
        id: "ending-review",
        title: "거울 조각 1번 정리",
        playerRole: "시간 탐험가",
        missionId: "mirror-room",
        stepId: "mirror-pieces",
        nextAction: "다음 거울 조각을 올리세요.",
        lines: [
          "대행렬도엔 고구려의 신분 순서가 담겼지.",
        ],
      },
    ],
  },
  {
    id: "godu",
    name: "고두",
    kind: "main",
    mapNames: ["무용총", "고구려 무용총"],
    profileImageUrl: `${NPC_PROFILE_IMAGE_BASE_URL}/godu.png`,
    role: "수렵도, 무용도, 접객도 체험과 Web Game, 불교 수용 퀴즈 연결",
    scenes: [
      {
        id: "intro",
        title: "무용총 안내",
        playerRole: "고구려 무사",
        missionId: "muyongchong",
        stepId: "npc-dialog",
        afterGameTrigger: "game:muyongchong-hunting",
        nextAction: "게임 시작 버튼을 눌러 수렵도 활쏘기를 시작하세요.",
        speakerlessLineTexts: [
          "무용총에서는 고구려 귀족의 사냥·춤·불교 수용 모습을 살펴봅니다.",
          "2분 동안 활을 당겨 맞히세요!",
        ],
        lines: [
          "무용총에서는 고구려 귀족의 사냥·춤·불교 수용 모습을 살펴봅니다.",
          "하하! 새로 온 애송이 무사로구나!",
          "우리 무사는 달리는 말 위에서도 활을 쏜단다.",
          "뒤를 홱 돌아보며 쏘면 진짜 고수지!",
        ],
        choices: [
          {
            id: "try-archery",
            label: "해 볼게요!",
            lines: [
              "사슴·멧돼지·호랑이·꿩, 다 잡아 보렴!",
              "2분 동안 활을 당겨 맞히세요!",
            ],
            speakerlessLineTexts: ["2분 동안 활을 당겨 맞히세요!"],
          },
          {
            id: "not-confident",
            label: "자신 없는데요...",
            lines: [
              "하하, 겁내지 마라! 사슴부터 슬슬 노려 봐.",
              "사슴·멧돼지·호랑이·꿩, 다 잡아 보렴!",
              "2분 동안 활을 당겨 맞히세요!",
            ],
            speakerlessLineTexts: ["2분 동안 활을 당겨 맞히세요!"],
          },
        ],
      },
      {
        id: "intro-help",
        title: "활쏘기 격려",
        playerRole: "고구려 무사",
        nextAction: "선택지: ① 해 볼게요! ② 자신 없는데요...",
        lines: [
          "하하, 겁내지 마라! 사슴부터 슬슬 노려 봐.",
        ],
      },
      {
        id: "hunting-game",
        title: "수렵도 활쏘기",
        playerRole: "고구려 무사",
        missionId: "muyongchong",
        stepId: "hunting-mural",
        afterGameTrigger: "game:muyongchong-hunting",
        nextAction: "게임 시작 버튼을 눌러 수렵도 활쏘기를 시작하세요.",
        speakerlessLineTexts: [
          "2분 동안 활을 당겨 맞히세요!",
        ],
        lines: [
          "사슴·멧돼지·호랑이·꿩, 다 잡아 보렴!",
          "2분 동안 활을 당겨 맞히세요!",
        ],
      },
      {
        id: "hunting-success",
        title: "활쏘기 성공",
        playerRole: "고구려 무사",
        missionId: "muyongchong",
        stepId: "archery-game",
        nextAction: "무용도 춤 발판으로 이동하세요.",
        lines: [
          "명중이다! 제법 무사 티가 나는걸, 하하!",
          "무희를 한번 찾아가보렴.",
        ],
      },
      {
        id: "dance-floor",
        title: "무용도 춤 발판",
        playerRole: "고구려 무사",
        missionId: "muyongchong",
        stepId: "dance-mural",
        afterGameTrigger: "game:muyongchong-dance",
        nextAction: "화살표를 순서대로 눌러보세요.",
        speakerlessLineTexts: [
          "화살표를 순서대로 눌러보세요!",
        ],
        lines: [
          "이번엔 무희와 함께 춤을 한번 춰 볼까?",
          "화살표를 순서대로 눌러보세요!",
        ],
      },
      {
        id: "dance-fail",
        title: "춤 발판 실패",
        playerRole: "고구려 무사",
        nextAction: "발판 순서를 처음부터 다시 밟으세요.",
        lines: [
          "어이쿠, 발이 꼬였구나! 처음부터 다시!",
        ],
      },
      {
        id: "dance-success",
        title: "춤 발판 성공",
        playerRole: "고구려 무사",
        missionId: "muyongchong",
        stepId: "arrow-order-game",
        nextAction: "다음 스테이지로 이동하세요.",
        lines: [
          "좋아! 이제 너도 우리 한 패가 됐구나, 하하!",
          "다음 스테이지로 이동하거라.",
        ],
      },
      {
        id: "reception-hint",
        title: "접객도 해설",
        playerRole: "고구려 무사",
        missionId: "muyongchong",
        stepId: "guest-mural",
        afterNpcTrigger: "npc:godu:final-quiz",
        nextAction: "접객도 설명을 듣고 최종 퀴즈를 풀어보세요.",
        speakerlessLineTexts: [
          "고구려는 372년 소수림왕 때 불교를 받아들였다.",
        ],
        lines: [
          "고구려는 372년 소수림왕 때 불교를 받아들였다.",
        ],
      },
      {
        id: "final-quiz",
        title: "무용총 최종 퀴즈",
        playerRole: "고구려 무사",
        nextAction: "선택지: ① 광개토대왕 ② 소수림왕 ③ 장수왕",
        lines: [
          "그림 속 이분은 멀리서 온 스님이란다.",
          "불교는 백제·신라에도 퍼져 큰 힘이 됐지.",
          "자, 묻겠다! 불교를 처음 받아들인 고구려 왕은?",
        ],
        choices: [
          {
            id: "gwanggaeto",
            label: "광개토대왕",
            repeatOnComplete: true,
            lines: [
              "허허, 아까 바닥 돌판을 다시 떠올려 봐.",
            ],
          },
          {
            id: "sosurim",
            label: "소수림왕",
            missionId: "muyongchong",
            stepId: "final-quiz",
            lines: [
              "하하 맞다! 소수림왕이 불교를 받아들였지.",
              "다음으로 이동하지!",
            ],
          },
          {
            id: "jangsu",
            label: "장수왕",
            repeatOnComplete: true,
            lines: [
              "허허, 아까 바닥 돌판을 다시 떠올려 봐.",
            ],
          },
        ],
      },
      {
        id: "final-quiz-correct",
        title: "퀴즈 정답",
        playerRole: "고구려 무사",
        missionId: "muyongchong",
        stepId: "final-quiz",
        nextAction: "거울 조각과 활·화살 보상을 받으세요.",
        lines: [
          "하하 맞다! 소수림왕이 불교를 받아들였지.",
          "다음으로 이동하지!",
        ],
      },
      {
        id: "final-quiz-wrong",
        title: "퀴즈 오답",
        playerRole: "고구려 무사",
        nextAction: "바닥 돌판의 372년 힌트를 다시 떠올리세요.",
        lines: [
          "허허, 아까 바닥 돌판을 다시 떠올려 봐.",
        ],
      },
      {
        id: "reward",
        title: "무용총 보상",
        playerRole: "고구려 무사",
        nextAction: "시간 광장으로 복귀합니다.",
        requiresCompletedSteps: {
          message: "미션을 모두 수행하고 이동하세요.",
          missionId: "muyongchong",
          stepIds: ["npc-dialog", "archery-game", "arrow-order-game"],
        },
        afterMapTeleport: {
          delayMs: 300,
          mapHashId: "eX9klK",
        },
        autoCompleteFinalLineDelayMs: 1200,
        speakerlessLineTexts: [
          "이번 고분에서 알게 된 것: 고구려 귀족은 무(武)·악(樂)·불(佛) 세 갈래로 엮여 살아갔다.",
          "시간 광장으로 복귀합니다.",
        ],
        lines: [
          "이번 고분에서 알게 된 것: 고구려 귀족은 무(武)·악(樂)·불(佛) 세 갈래로 엮여 살아갔다.",
          "거울 조각과 활·화살을 받아라. 잘 싸웠다, 하하!",
          "시간 광장으로 복귀합니다.",
        ],
        rewardItems: [
          {
            name: "청동거울 조각 ②번",
            imageUrl: "../images/items/bronze-mirror-fragment-2.jpg",
            description: "무용총에서 획득한 두 번째 청동거울 조각입니다.",
            quantity: 1,
          },
          {
            name: "활과 화살",
            imageUrl: "../images/items/bow-arrows.jpg",
            description: "무용총 수렵도 미션에서 얻은 사후 세계 물건입니다.",
            quantity: 1,
          },
        ],
      },
      {
        id: "dancer-guide",
        title: "무희 안내",
        playerRole: "고구려 무사",
        displayName: "무희",
        displayProfileImageUrl: `${NPC_PROFILE_IMAGE_BASE_URL}/dancer.png`,
        nextAction: "벽화 가까이에서 미션을 수행하세요.",
        lines: [
          "벽에 있는 그림에 가까이 가서 미션을 수행해 주세요!",
        ],
      },
      {
        id: "ending-review",
        title: "거울 조각 2번 정리",
        playerRole: "시간 탐험가",
        missionId: "mirror-room",
        stepId: "mirror-pieces",
        nextAction: "다음 거울 조각을 올리세요.",
        lines: [
          "무용총은 고구려의 사냥·춤·불교를 보여 주지.",
        ],
      },
    ],
  },
  {
    id: "dancer",
    name: "무희 NPC",
    kind: "support",
    mapNames: ["무용총", "고구려 무용총"],
    profileImageUrl: `${NPC_PROFILE_IMAGE_BASE_URL}/dancer.png`,
    role: "무용도 구역 분위기 연출과 춤 문화 체험 보조",
    scenes: [
      {
        id: "ambient",
        title: "무용도 체험 보조",
        playerRole: "고구려 무사",
        nextAction: "무용도 설명을 확인하고 화살표 순서 활동으로 이동하세요.",
        lines: [
          "무희가 춤 동작을 시범으로 보여 줍니다.",
        ],
      },
    ],
  },
  {
    id: "jinmyosu",
    name: "석수 진묘수",
    kind: "main",
    mapNames: ["무령왕릉", "백제 무령왕릉"],
    profileImageUrl: `${NPC_PROFILE_IMAGE_BASE_URL}/jinmyosu.png`,
    role: "묘지석 해독, 무덤 주인 확인, 부장품 교류 지도 미션 안내",
    scenes: [
      {
        id: "entrance-toast",
        title: "무령왕릉 입구 안내",
        playerRole: "탐험 방문자",
        oncePerPlayer: true,
        skipWidget: true,
        toastMessage: {
          durationMs: 5000,
          text: "무령왕릉은 붉은 벽돌을 쌓아 만든 ‘벽돌무덤’으로, 중국 남조의 영향을 받은 백제만의 고분입니다.",
        },
        lines: [],
      },
      {
        id: "entrance-camera",
        title: "무덤 내부 입구",
        playerRole: "탐험 방문자",
        oncePerPlayer: true,
        skipWidget: true,
        cameraFocus: {
          durationMs: 3000,
          moveDuration: 0.45,
          x: 30,
          y: 91,
        },
        lines: [],
      },
      {
        id: "brick-tomb-guide",
        title: "벽돌무덤 안내",
        playerRole: "탐험 방문자",
        oncePerPlayer: true,
        displayName: "",
        displayProfileImageUrl: "",
        preDialogueCameraFocus: {
          durationMs: 3000,
          lockMovement: true,
          moveDuration: 0.45,
          x: 30,
          y: 91,
        },
        nextAction: "입구 포털을 통해 무령왕릉 널방으로 이동하세요.",
        speakerlessLineTexts: [
          "벽돌을 쌓아 만든 무덤입니다. 무령왕릉은 붉은 벽돌과 아치형 천장 구조가 특징입니다.",
          "입구 포털을 통해 무령왕릉 널방으로 이동하세요.",
        ],
        lines: [
          "벽돌을 쌓아 만든 무덤입니다. 무령왕릉은 붉은 벽돌과 아치형 천장 구조가 특징입니다.",
          "입구 포털을 통해 무령왕릉 널방으로 이동하세요.",
        ],
      },
      {
        id: "first-meeting",
        title: "널방 진입",
        playerRole: "탐험 방문자",
        missionId: "muryeong-tomb",
        stepId: "npc-dialog",
        nextAction: "선택지: ① 묘지석을 읽어볼게요. ② 진묘수가 뭔가요?",
        speakerlessLineTexts: ["바닥에 놓인 묘지석과 F키로 상호작용하세요."],
        lines: [
          "크르릉… 낯선 자여, 이곳은 백제 왕릉의 깊은 방이다.",
          "나는 무덤을 지키는 상상 속 짐승, 진묘수다.",
          "무덤 안으로 더 들어가기 전에 먼저 바닥의 묘지석을 읽어 보아라.",
          "그 글이 이 무덤의 주인이 누구인지 직접 알려 줄 것이다.",
        ],
        choices: [
          {
            id: "read-epitaph",
            label: "묘지석을 읽어볼게요.",
            lines: ["바닥에 놓인 묘지석과 F키로 상호작용하세요."],
            speakerlessLineTexts: ["바닥에 놓인 묘지석과 F키로 상호작용하세요."],
          },
          {
            id: "what-is-jinmyosu",
            label: "진묘수가 뭔가요?",
            lines: [
              "진묘수는 무덤을 지키기 위해 만든 상상 속 짐승이다.",
              "죽은 이를 보호하고, 나쁜 기운이 무덤 안으로 들어오지 못하게 막는 역할을 하지.",
              "바닥에 놓인 묘지석과 F키로 상호작용하세요.",
            ],
            speakerlessLineTexts: ["바닥에 놓인 묘지석과 F키로 상호작용하세요."],
          },
        ],
      },
      {
        id: "burial-goods-guide",
        title: "부장품 교류 단서",
        playerRole: "탐험 방문자",
        missionId: "muryeong-tomb",
        stepId: "burial-goods-guide",
        nextAction: "세 부장품을 모두 살펴보고 교류 지도에 연결하세요.",
        lines: [
          "이 방에 놓인 물건들은 단순한 장식이 아니다.",
          "각 부장품은 백제가 어떤 지역과 교류했는지를 알려 주는 단서이다.",
          "문 넘어 있는 세 물건을 모두 잘 살펴보고, 어느 지역과 관련이 있는지 지도 위에 알맞게 연결해 보아라.",
        ],
      },
      {
        id: "intro",
        title: "무령왕릉 안내",
        playerRole: "탐험 방문자",
        missionId: "muryeong-tomb",
        stepId: "npc-dialog",
        nextAction: "묘지석과 주요 부장품을 확인한 뒤 교류 지도로 이동하세요.",
        lines: [
          "크르릉... 나는 무덤을 지키는 짐승, 진묘수다.",
          "들어오려거든 먼저 바닥의 묘지석을 읽어라.",
          "그 글이 무덤의 주인을 알려 줄 것이다.",
        ],
      },
      {
        id: "intro-help",
        title: "진묘수 설명",
        playerRole: "탐험 방문자",
        nextAction: "선택지: ① 묘지석을 읽어볼게요. ② 진묘수가 뭔가요?",
        lines: [
          "무덤을 지키라고 만든 상상 속 짐승이다.",
        ],
      },
      {
        id: "epitaph",
        title: "묘지석 해독",
        playerRole: "탐험 방문자",
        missionId: "muryeong-tomb",
        stepId: "epitaph",
        nextAction: "주요 부장품을 확인하고 교류 지도로 이동하세요.",
        lines: [
          "묘지석에 왕과 왕비의 이름·사망 연도가 적혀 있다.",
          "이 글 덕분에 주인이 누구인지 밝혀졌다.",
          "바로 백제의 무령왕과 그 왕비이다.",
        ],
      },
      {
        id: "exchange-map",
        title: "부장품 교류 지도",
        playerRole: "탐험 방문자",
        requiresCompletedSteps: {
          missionId: "muryeong-tomb",
          stepIds: ["bronze-mirror", "pine-coffin", "ebony-pillow"],
          message: "미션을 모두 수행하고 이동하세요.",
        },
        afterGameTrigger: "game:jinmyosu-artifact-map",
        afterGameRequiresSteps: {
          missionId: "muryeong-tomb",
          stepIds: ["bronze-mirror", "pine-coffin", "ebony-pillow"],
          message: "세 부장품 힌트를 모두 확인한 뒤 교류 지도를 시작합니다.",
        },
        nextAction: "부장품을 알맞은 지역으로 끌어다 놓으세요.",
        speakerlessLineTexts: [
          "부장품을 알맞은 지역으로 끌어다 놓으세요.",
        ],
        lines: [
          "부장품을 알맞은 지역으로 끌어다 놓으세요.",
        ],
      },
      {
        id: "bronze-mirror",
        title: "청동거울",
        playerRole: "탐험 방문자",
        missionId: "muryeong-tomb",
        stepId: "bronze-mirror",
        nextAction: "금송 목관 조각을 확인하세요.",
        speakerlessLineTexts: [
          "청동거울은 중국 남조 양나라에서 주로 만들어진 물건과 관련이 있습니다.",
          "백제가 중국 남조와 교류했음을 보여 주는 단서입니다.",
        ],
        lines: [
          "청동거울은 중국 남조 양나라에서 주로 만들어진 물건과 관련이 있습니다.",
          "백제가 중국 남조와 교류했음을 보여 주는 단서입니다.",
        ],
      },
      {
        id: "pine-coffin",
        title: "금송 목관 조각",
        playerRole: "탐험 방문자",
        missionId: "muryeong-tomb",
        stepId: "pine-coffin",
        nextAction: "흑단 두침을 확인하세요.",
        speakerlessLineTexts: [
          "금송은 일본 열도 남부에서 자라는 나무입니다.",
          "무령왕릉의 목관 재료는 백제와 일본 열도의 해상 교류를 보여 줍니다.",
        ],
        lines: [
          "금송은 일본 열도 남부에서 자라는 나무입니다.",
          "무령왕릉의 목관 재료는 백제와 일본 열도의 해상 교류를 보여 줍니다.",
        ],
      },
      {
        id: "ebony-pillow",
        title: "흑단 두침",
        playerRole: "탐험 방문자",
        missionId: "muryeong-tomb",
        stepId: "ebony-pillow",
        nextAction: "부장품 교류 지도 짝짓기를 시작합니다.",
        speakerlessLineTexts: [
          "흑단은 동남아 계통의 귀한 목재로 알려져 있습니다.",
          "멀리 남쪽 바다의 교역권과 연결된 백제의 교류 범위를 생각해 볼 수 있습니다.",
        ],
        lines: [
          "흑단은 동남아 계통의 귀한 목재로 알려져 있습니다.",
          "멀리 남쪽 바다의 교역권과 연결된 백제의 교류 범위를 생각해 볼 수 있습니다.",
        ],
      },
      {
        id: "exchange-wrong",
        title: "교류 지도 오답",
        playerRole: "탐험 방문자",
        nextAction: "부장품의 원산지를 다시 떠올리세요.",
        lines: [
          "그 자리가 아니다. 물건의 재료와 만들어진 지역을 다시 떠올려 보아라.",
          "힌트를 다시 확인하고 알맞은 지역으로 옮겨 보거라.",
        ],
      },
      {
        id: "exchange-correct",
        title: "교류 지도 정답",
        playerRole: "탐험 방문자",
        missionId: "muryeong-tomb",
        stepId: "exchange-region-game",
        nextAction: "최종 퀴즈로 이동하세요.",
        lines: [
          "그렇다. 잘 짝지었구나.",
          "우리 백제는 중국 남조, 왜, 그리고 남쪽 바다의 여러 지역과 이어진 나라였다.",
          "무령왕릉의 부장품은 백제가 바닷길을 통해 넓은 세계와 교류했음을 보여 준다.",
        ],
      },
      {
        id: "final-quiz",
        title: "무령왕릉 최종 퀴즈",
        playerRole: "탐험 방문자",
        requiresCompletedSteps: {
          missionId: "muryeong-tomb",
          stepIds: ["exchange-region-game"],
          message: "미션을 모두 수행하고 이동하세요.",
        },
        nextAction: "선택지: ① 사비(부여) ② 한성(서울) ③ 국내성(지안)",
        lines: [
          "이제 마지막 질문이다.",
          "백제는 한때 수도를 옮기며 새로운 왕실 문화를 이어 갔다.",
          "백제가 웅진으로 옮기기 전의 수도는 어디였을까?",
        ],
        choices: [
          {
            id: "sabi",
            label: "사비(부여)",
            repeatOnComplete: true,
            lines: [
              "아직 아니다.",
              "백제가 웅진으로 옮기기 전, 지금의 서울 일대에 있었던 수도를 떠올려 보아라.",
            ],
          },
          {
            id: "hanseong",
            label: "한성(서울)",
            missionId: "muryeong-tomb",
            stepId: "final-quiz",
            lines: [
              "그렇다. 정답은 한성이다.",
              "백제는 475년 고구려의 압박으로 한성에서 웅진으로 수도를 옮겼다.",
              "이후 다시 사비로 천도하며 백제의 역사와 문화는 이어졌다.",
            ],
          },
          {
            id: "guknaeseong",
            label: "국내성(지안)",
            repeatOnComplete: true,
            lines: [
              "아직 아니다.",
              "백제가 웅진으로 옮기기 전, 지금의 서울 일대에 있었던 수도를 떠올려 보아라.",
            ],
          },
        ],
      },
      {
        id: "final-quiz-correct",
        title: "퀴즈 정답",
        playerRole: "탐험 방문자",
        missionId: "muryeong-tomb",
        stepId: "final-quiz",
        nextAction: "거울 조각과 금송 조각 보상을 받으세요.",
        lines: [
          "그렇다. 정답은 한성이다.",
          "백제는 475년 고구려의 압박으로 한성에서 웅진으로 수도를 옮겼다.",
          "이후 다시 사비로 천도하며 백제의 역사와 문화는 이어졌다.",
        ],
      },
      {
        id: "final-quiz-wrong",
        title: "퀴즈 오답",
        playerRole: "탐험 방문자",
        nextAction: "지금의 서울 일대에 있었던 수도를 다시 떠올리세요.",
        lines: [
          "아직 아니다.",
          "백제가 웅진으로 옮기기 전, 지금의 서울 일대에 있었던 수도를 떠올려 보아라.",
        ],
      },
      {
        id: "reward",
        title: "무령왕릉 정리·보상",
        playerRole: "탐험 방문자",
        nextAction: "시간 광장으로 복귀합니다.",
        afterMapTeleport: {
          delayMs: 300,
          mapHashId: "7RbjZ7",
        },
        autoCompleteFinalLineDelayMs: 1200,
        speakerlessLineTexts: [
          "이번 고분에서 우리가 알게 된 것",
          "무령왕릉은 주인이 밝혀진 삼국 시대의 드문 왕릉입니다.",
          "묘지석을 통해 백제 제25대 무령왕과 왕비의 무덤임을 알 수 있습니다.",
          "청동거울, 금송 목관 조각, 흑단 두침 등은 백제가 중국·일본·동남아를 잇는 해상 교류의 중심이었음을 보여 줍니다.",
          "붉은 벽돌과 아치형 천장은 중국 남조의 영향을 받은 백제 벽돌무덤의 특징입니다.",
          "청동거울 조각 ③번과",
          "사후 세계 물건 〈금송 조각〉을 획득했습니다.",
          "시간 광장으로 복귀합니다.",
        ],
        lines: [
          "이번 고분에서 우리가 알게 된 것",
          "무령왕릉은 주인이 밝혀진 삼국 시대의 드문 왕릉입니다.",
          "묘지석을 통해 백제 제25대 무령왕과 왕비의 무덤임을 알 수 있습니다.",
          "청동거울, 금송 목관 조각, 흑단 두침 등은 백제가 중국·일본·동남아를 잇는 해상 교류의 중심이었음을 보여 줍니다.",
          "붉은 벽돌과 아치형 천장은 중국 남조의 영향을 받은 백제 벽돌무덤의 특징입니다.",
          "잘했다, 시간 탐험가여.",
          "너는 묘지석을 읽고, 부장품이 알려 주는 백제의 교류를 밝혀냈다.",
          "이제 청동거울 조각과 금송 조각을 가져가거라.",
          "다음 고분에서도 잃어버린 기억을 찾아야 한다.",
          "청동거울 조각 ③번과",
          "사후 세계 물건 〈금송 조각〉을 획득했습니다.",
          "시간 광장으로 복귀합니다.",
        ],
        rewardItems: [
          {
            name: "청동거울 조각 ③번",
            imageUrl: "../images/items/bronze-mirror-fragment-3.jpg",
            description: "무령왕릉에서 획득한 세 번째 청동거울 조각입니다.",
            quantity: 1,
          },
          {
            name: "금송 조각",
            imageUrl: "../images/items/pine-wood-fragment.jpg",
            description: "무령왕릉의 금송 목관에서 얻은 사후 세계 물건입니다.",
            quantity: 1,
          },
        ],
      },
      {
        id: "ending-review",
        title: "거울 조각 3번 정리",
        playerRole: "시간 탐험가",
        missionId: "mirror-room",
        stepId: "mirror-pieces",
        nextAction: "다음 거울 조각을 올리세요.",
        lines: [
          "무령왕릉은 백제가 바다로 교류한 증거란다.",
        ],
      },
    ],
  },
  {
    id: "seoki",
    name: "석이",
    kind: "main",
    mapNames: ["천마총", "신라 천마총"],
    profileImageUrl: `${NPC_PROFILE_IMAGE_BASE_URL}/seoki.png`,
    role: "돌무지덧널무덤 축조 과정, 황금 문화, 서역계 유리잔 탐색 안내",
    scenes: [
      {
        id: "intro",
        title: "천마총 안내",
        playerRole: "축조 현장 견습",
        missionId: "cheonmachong",
        stepId: "npc-dialog",
        nextAction: "내부로 이동해 단면 구조를 확인하세요.",
        speakerlessLineTexts: [
          "천마총에서는 신라 지배층의 무덤 구조와 대외 교류의 흔적을 살펴봅니다.",
          "내부로 이동해보자.",
        ],
        lines: [
          "천마총에서는 신라 지배층의 무덤 구조와 대외 교류의 흔적을 살펴봅니다.",
          "어서 오게, 여기가 바로 신라 천마총이야.",
          "고구려·백제와 아주 다른 '돌무지덧널무덤'이지.",
          "다 만들면 못 들어가니, 만드는 걸 지금 보자.",
        ],
        choices: [
          {
            id: "how-build",
            label: "어떻게 만들어요?",
            speakerlessLineTexts: ["내부로 이동해보자."],
            lines: [
              "나무 덧널에 왕을 모신 뒤 돌과 흙을 덮지.",
              "내부로 이동해보자.",
            ],
          },
          {
            id: "look-now",
            label: "바로 살펴볼게요!",
            speakerlessLineTexts: ["내부로 이동해보자."],
            lines: [
              "내부로 이동해보자.",
            ],
          },
        ],
      },
      {
        id: "intro-help",
        title: "축조 방식 설명",
        playerRole: "축조 현장 견습",
        nextAction: "선택지: ① 어떻게 만들어요? ② 바로 살펴볼게요!",
        lines: [
          "나무 덧널에 왕을 모신 뒤 돌과 흙을 덮지.",
        ],
      },
      {
        id: "wooden-chamber",
        title: "덧널",
        playerRole: "축조 현장 견습",
        missionId: "cheonmachong",
        stepId: "wooden-chamber",
        nextAction: "돌무지를 확인하세요.",
        speakerlessLineTexts: [
          "고인을 넣는 나무 덧널입니다.",
        ],
        lines: [
          "고인을 넣는 나무 덧널입니다.",
        ],
      },
      {
        id: "stone-mound",
        title: "돌무지",
        playerRole: "축조 현장 견습",
        missionId: "cheonmachong",
        stepId: "stone-mound",
        nextAction: "봉토를 확인하세요.",
        speakerlessLineTexts: [
          "도굴을 막기 위해 쌓은 돌무지입니다.",
        ],
        lines: [
          "도굴을 막기 위해 쌓은 돌무지입니다.",
        ],
      },
      {
        id: "burial-mound",
        title: "봉토",
        playerRole: "축조 현장 견습",
        missionId: "cheonmachong",
        stepId: "burial-mound",
        nextAction: "복식 복원 활동으로 이동하세요.",
        speakerlessLineTexts: [
          "겉을 덮는 흙, 봉토입니다.",
        ],
        lines: [
          "겉을 덮는 흙, 봉토입니다.",
          "이렇게 쌓으면 도둑이 파기 아주 어렵단다.",
        ],
      },
      {
        id: "costume",
        title: "복식 복원도",
        playerRole: "축조 현장 견습",
        afterGameTrigger: "game:cheonmachong-costume",
        nextAction: "금관·금허리띠·귀걸이를 알맞은 위치에 놓으세요.",
        speakerlessLineTexts: [
          "복제품 카드를 머리·허리·귀에 맞게 끌어다 놓으세요!",
        ],
        lines: [
          "자, 금관·금허리띠·귀걸이를 제자리에 놓아 봐.",
          "복제품 카드를 머리·허리·귀에 맞게 끌어다 놓으세요!",
        ],
      },
      {
        id: "costume-complete",
        title: "복식 복원 완성",
        playerRole: "축조 현장 견습",
        missionId: "cheonmachong",
        stepId: "gold-accessory-game",
        nextAction: "서역계 유리잔을 확인하세요.",
        lines: [
          "신라 왕과 귀족은 화려한 금으로 위엄을 뽐냈지.",
        ],
      },
      {
        id: "glass-cup",
        title: "서역계 유리잔",
        playerRole: "축조 현장 견습",
        missionId: "cheonmachong",
        stepId: "glass-cup",
        nextAction: "최종 퀴즈로 이동하세요.",
        lines: [
          "저기 봐, 멀리 서역에서 온 유리잔도 나왔어.",
          "신라가 먼 나라와도 사귀었다는 증거란다.",
        ],
      },
      {
        id: "final-quiz",
        title: "천마총 최종 퀴즈",
        playerRole: "축조 현장 견습",
        missionId: "cheonmachong",
        stepId: "glass-cup",
        nextAction: "선택지: ① 벽화가 많아서 ② 돌·흙을 두껍게 쌓아서 ③ 입구가 커서",
        lines: [
          "저기 봐, 멀리 서역에서 온 유리잔도 나왔어.",
          "신라가 먼 나라와도 사귀었다는 증거란다.",
          "자, 이 돌무지덧널무덤은 왜 도둑이 못 팠을까?",
        ],
        choices: [
          {
            id: "many-murals",
            label: "벽화가 많아서",
            repeatOnComplete: true,
            lines: [
              "허허, 아까 본 무덤 속 모습을 떠올려 봐.",
            ],
          },
          {
            id: "thick-stones-soil",
            label: "덧널 위에 돌·흙을 두껍게 쌓아서",
            missionId: "cheonmachong",
            stepId: "final-quiz",
            lines: [
              "그렇지! 그 덕분에 보물이 그대로 남았단다.",
            ],
          },
          {
            id: "large-entrance",
            label: "입구가 커서",
            repeatOnComplete: true,
            lines: [
              "허허, 아까 본 무덤 속 모습을 떠올려 봐.",
            ],
          },
        ],
      },
      {
        id: "final-quiz-correct",
        title: "퀴즈 정답",
        playerRole: "축조 현장 견습",
        missionId: "cheonmachong",
        stepId: "final-quiz",
        nextAction: "거울 조각과 유리잔 보상을 받으세요.",
        lines: [
          "그렇지! 그 덕분에 보물이 그대로 남았단다.",
        ],
      },
      {
        id: "final-quiz-wrong",
        title: "퀴즈 오답",
        playerRole: "축조 현장 견습",
        nextAction: "무덤 속 단면 구조를 다시 떠올리세요.",
        lines: [
          "허허, 아까 본 무덤 속 모습을 떠올려 봐.",
        ],
      },
      {
        id: "reward",
        title: "천마총 보상",
        playerRole: "축조 현장 견습",
        nextAction: "시간 광장으로 복귀합니다.",
        requiresCompletedSteps: {
          message: "미션을 모두 수행하고 오세요.",
          missionId: "cheonmachong",
          stepIds: ["final-quiz"],
        },
        afterMapTeleport: {
          delayMs: 300,
          mapHashId: "r7lopO",
        },
        autoCompleteFinalLineDelayMs: 1200,
        speakerlessLineTexts: [
          "이번 고분에서 알게 된 것: 신라는 화려한 황금 문화와 함께 멀리 서역에 이르는 국제 교류망 속에서 성장했다.",
          "시간 광장으로 복귀합니다.",
        ],
        lines: [
          "이번 고분에서 알게 된 것: 신라는 화려한 황금 문화와 함께 멀리 서역에 이르는 국제 교류망 속에서 성장했다.",
          "수고했네! 거울 조각과 유리잔을 받으렴.",
          "시간 광장으로 복귀합니다.",
        ],
        rewardItems: [
          {
            name: "청동거울 조각 ④번",
            imageUrl: "../images/items/bronze-mirror-fragment-4.jpg",
            description: "천마총에서 획득한 네 번째 청동거울 조각입니다.",
            quantity: 1,
          },
          {
            name: "서역계 유리잔",
            imageUrl: "../images/items/western-glass-cup.jpg",
            description: "천마총에서 얻은 사후 세계 물건입니다.",
            quantity: 1,
          },
        ],
      },
      {
        id: "ending-review",
        title: "거울 조각 4번 정리",
        playerRole: "시간 탐험가",
        missionId: "mirror-room",
        stepId: "mirror-pieces",
        nextAction: "다음 거울 조각을 올리세요.",
        lines: [
          "천마총은 신라의 황금과 서역 교류를 말하지.",
        ],
      },
    ],
  },
  {
    id: "gwanghoek",
    name: "광획",
    kind: "main",
    mapNames: ["대성동 고분군", "가야 대성동 고분군"],
    profileImageUrl: `${NPC_PROFILE_IMAGE_BASE_URL}/gwanghoek.png`,
    role: "가야 철 생산과 가공 과정, 철제 유물 용도, 해상 교역 안내",
    scenes: [
      {
        id: "intro",
        title: "대성동 고분군 안내",
        playerRole: "철 장인 견습",
        missionId: "daeseongdong",
        stepId: "npc-dialog",
        nextAction: "철 생산에 필요한 아이템들을 찾아보세요.",
        speakerlessLineTexts: [
          "대성동 고분군에서는 가야의 철 생산과 해상 교역 모습을 살펴봅니다.",
        ],
        lines: [
          "대성동 고분군에서는 가야의 철 생산과 해상 교역 모습을 살펴봅니다.",
          "하하! 가야의 힘은 바로 좋은 철에서 나오지!",
          "자, 먼저 철 만들고 다듬는 법을 배워 보자.",
        ],
        choices: [
          {
            id: "how-make-iron",
            label: "철을 어떻게 만들어요?",
            lines: [
              "돌에서 쇠를 뽑아내는 걸 '제련'이라 한단다.",
              "곳곳에 놓여 있는 철 생산에 필요한 아이템들을 찾아보거라!",
            ],
          },
          {
            id: "learn-now",
            label: "바로 배워 볼게요!",
            speakerlessLineTexts: [
              "곳곳에 놓여 있는 철 생산에 필요한 아이템들을 찾아보거라!",
            ],
            lines: [
              "곳곳에 놓여 있는 철 생산에 필요한 아이템들을 찾아보거라!",
            ],
          },
        ],
      },
      {
        id: "intro-help",
        title: "제련 설명",
        playerRole: "철 장인 견습",
        nextAction: "선택지: ① 철을 어떻게 만들어요? ② 바로 배워 볼게요!",
        lines: [
          "돌에서 쇠를 뽑아내는 걸 '제련'이라 한단다.",
        ],
      },
      {
        id: "iron-ore",
        title: "철광석",
        playerRole: "철 장인 견습",
        missionId: "daeseongdong",
        stepId: "iron-ore",
        nextAction: "철 생산 아이템을 계속 찾아보세요.",
        speakerlessLineTexts: ["철광석을 찾았습니다."],
        lines: ["철광석을 찾았습니다."],
      },
      {
        id: "charcoal",
        title: "숯",
        playerRole: "철 장인 견습",
        missionId: "daeseongdong",
        stepId: "charcoal",
        nextAction: "철 생산 아이템을 계속 찾아보세요.",
        speakerlessLineTexts: ["숯을 찾았습니다."],
        lines: ["숯을 찾았습니다."],
      },
      {
        id: "bellows",
        title: "풀무",
        playerRole: "철 장인 견습",
        missionId: "daeseongdong",
        stepId: "bellows",
        nextAction: "철 생산 아이템을 계속 찾아보세요.",
        speakerlessLineTexts: ["풀무를 찾았습니다."],
        lines: ["풀무를 찾았습니다."],
      },
      {
        id: "furnace",
        title: "제련로",
        playerRole: "철 장인 견습",
        missionId: "daeseongdong",
        stepId: "furnace",
        nextAction: "철 생산 아이템을 계속 찾아보세요.",
        speakerlessLineTexts: ["제련로를 찾았습니다."],
        lines: ["제련로를 찾았습니다."],
      },
      {
        id: "iron-production",
        title: "철 제련·가공",
        playerRole: "철 장인 견습",
        afterGameTrigger: "game:daeseongdong-iron-process",
        afterGameRequiresSteps: {
          message: "철 생산에 필요한 아이템을 모두 찾고 오세요.",
          missionId: "daeseongdong",
          stepIds: ["iron-ore", "charcoal", "bellows", "furnace"],
        },
        nextAction: "철 생산 순서를 맞혀 보세요.",
        speakerlessLineTexts: [
          "철 생산 순서를 맞히세요! (철광석→숯→풀무→제련로)",
        ],
        lines: [
          "철광석·숯·풀무·제련로를 차례대로 다뤄 보렴.",
          "철 생산 순서를 맞히세요! (철광석→숯→풀무→제련로)",
        ],
      },
      {
        id: "iron-success",
        title: "철 생산 성공",
        playerRole: "철 장인 견습",
        missionId: "daeseongdong",
        stepId: "iron-process-game",
        nextAction: "철제 유물 용도 짝짓기로 이동하세요.",
        lines: [
          "이 철로 무기도 만들고 농기구도 만들었단다.",
          "내부로 이동하게나.",
        ],
      },
      {
        id: "helmet",
        title: "투구",
        playerRole: "철 장인 견습",
        missionId: "daeseongdong",
        stepId: "helmet",
        nextAction: "철제 유물을 계속 찾아보세요.",
        speakerlessLineTexts: ["투구를 찾았습니다."],
        lines: ["투구를 찾았습니다."],
      },
      {
        id: "sword",
        title: "환두대도",
        playerRole: "철 장인 견습",
        missionId: "daeseongdong",
        stepId: "sword",
        nextAction: "철제 유물을 계속 찾아보세요.",
        speakerlessLineTexts: ["환두대도를 찾았습니다."],
        lines: ["환두대도를 찾았습니다."],
      },
      {
        id: "horse-gear",
        title: "말갖춤",
        playerRole: "철 장인 견습",
        missionId: "daeseongdong",
        stepId: "horse-gear",
        nextAction: "철제 유물을 계속 찾아보세요.",
        speakerlessLineTexts: ["말갖춤을 찾았습니다."],
        lines: ["말갖춤을 찾았습니다."],
      },
      {
        id: "armor",
        title: "갑옷",
        playerRole: "철 장인 견습",
        missionId: "daeseongdong",
        stepId: "armor",
        nextAction: "광획에게 돌아가 철제 유물의 쓰임을 맞혀 보세요.",
        speakerlessLineTexts: ["갑옷을 찾았습니다."],
        lines: ["갑옷을 찾았습니다."],
      },
      {
        id: "artifact-match",
        title: "철제 유물 용도",
        playerRole: "철 장인 견습",
        afterGameTrigger: "game:daeseongdong-artifact-match",
        afterGameRequiresSteps: {
          message: "철제 유물을 모두 찾고 오세요.",
          missionId: "daeseongdong",
          stepIds: ["helmet", "sword", "horse-gear", "armor"],
        },
        nextAction: "갑옷·말갖춤·환두대도·투구를 알맞은 대상과 연결하세요.",
        speakerlessLineTexts: [
          "갑옷·말갖춤·환두대도·투구를 알맞은 대상과 연결하세요!",
          "힌트: 갑옷은 장수, 말갖춤은 말, 큰 칼은 허리에!",
        ],
        lines: [
          "여기 있는 다양한 철제 유물을 찾아보게나.",
          "무덤에서 나온 철 물건의 쓰임을 맞혀 봐.",
          "갑옷·말갖춤·환두대도·투구를 알맞은 대상과 연결하세요!",
          "힌트: 갑옷은 장수, 말갖춤은 말, 큰 칼은 허리에!",
        ],
      },
      {
        id: "artifact-wrong",
        title: "유물 짝짓기 오답",
        playerRole: "철 장인 견습",
        nextAction: "힌트: 갑옷은 장수, 말갖춤은 말, 큰 칼은 허리입니다.",
        lines: [
          "어허, 짝이 틀렸네. 다시 연결해 보렴.",
        ],
      },
      {
        id: "artifact-correct",
        title: "유물 짝짓기 정답",
        playerRole: "철 장인 견습",
        missionId: "daeseongdong",
        stepId: "artifact-use-quiz",
        nextAction: "해상 교역 지도로 이동하세요.",
        lines: [
          "가야의 철은 힘과 장사 솜씨를 보여 준단다.",
          "아주 잘했네. 다음 공간으로 이동하게나.",
        ],
      },
      {
        id: "trade-map-guide",
        title: "해상 교역 지도 안내",
        playerRole: "철 장인 견습",
        nextAction: "큰 지도 앞으로 이동하세요.",
        speakerlessLineTexts: [
          "큰 지도가 보인다.",
          "앞으로 한번 이동해보자.",
        ],
        lines: [
          "큰 지도가 보인다.",
          "앞으로 한번 이동해보자.",
        ],
      },
      {
        id: "trade-map",
        title: "해상 교역 지도",
        playerRole: "철 장인 견습",
        missionId: "daeseongdong",
        stepId: "trade-map",
        nextAction: "가야와 백제·왜 열도를 잇는 바닷길을 확인하세요.",
        lines: [
          "가야와 백제·왜 열도를 잇는 해상 교역로가 표시된다.",
        ],
      },
      {
        id: "final-quiz",
        title: "대성동 고분군 최종 퀴즈",
        playerRole: "철 장인 견습",
        nextAction: "선택지: ① 금이 많아서 ② 질 좋은 철을 생산해 교역해서 ③ 큰 왕이 많아서",
        requiresCompletedSteps: {
          message: "해상 교역 지도를 먼저 확인하고 오세요.",
          missionId: "daeseongdong",
          stepIds: ["artifact-use-quiz"],
        },
        speakerlessLineTexts: [
          "가야와 백제·왜 열도를 잇는 해상 교역로가 표시된다.",
        ],
        lines: [
          "가야와 백제·왜 열도를 잇는 해상 교역로가 표시된다.",
          "자, 가야가 왜 '철의 왕국'으로 불렸을까?",
        ],
        choices: [
          {
            id: "gold-rich",
            label: "금이 많아서",
            repeatOnComplete: true,
            lines: [
              "어허, 방금 본 바닷길 지도를 떠올려 봐.",
            ],
          },
          {
            id: "quality-iron-trade",
            label: "질 좋은 철을 생산해 교역해서",
            missionId: "daeseongdong",
            stepId: "final-quiz",
            lines: [
              "그렇지! 가야의 철은 최고의 장사 밑천이었지.",
              "보상을 획득하고 시간 광장으로 복귀하게나.",
            ],
          },
          {
            id: "many-kings",
            label: "큰 왕이 많아서",
            repeatOnComplete: true,
            lines: [
              "어허, 방금 본 바닷길 지도를 떠올려 봐.",
            ],
          },
        ],
      },
      {
        id: "final-quiz-correct",
        title: "퀴즈 정답",
        playerRole: "철 장인 견습",
        missionId: "daeseongdong",
        stepId: "final-quiz",
        nextAction: "거울 조각과 철 갑옷 보상을 받으세요.",
        lines: [
          "그렇지! 가야의 철은 최고의 장사 밑천이었지.",
        ],
      },
      {
        id: "final-quiz-wrong",
        title: "퀴즈 오답",
        playerRole: "철 장인 견습",
        nextAction: "방금 본 바닷길 지도를 다시 떠올리세요.",
        lines: [
          "어허, 방금 본 바닷길 지도를 떠올려 봐.",
        ],
      },
      {
        id: "reward",
        title: "대성동 고분군 보상",
        playerRole: "철 장인 견습",
        nextAction: "시간광장으로 복귀합니다.",
        requiresCompletedSteps: {
          message: "최종 퀴즈를 먼저 완료하고 오세요.",
          missionId: "daeseongdong",
          stepIds: ["final-quiz"],
        },
        afterMapTeleport: {
          delayMs: 300,
          mapHashId: "AOrYmW",
        },
        autoCompleteFinalLineDelayMs: 1200,
        speakerlessLineTexts: [
          "이번 고분에서 알게 된 것: 가야 연맹은 철 생산과 해상 교역으로 성장한 독자적 세력이었다.",
          "시간광장으로 복귀합니다.",
        ],
        lines: [
          "이번 고분에서 알게 된 것: 가야 연맹은 철 생산과 해상 교역으로 성장한 독자적 세력이었다.",
          "잘했다, 하하! 거울 조각과 철 갑옷을 받으렴!",
          "시간광장으로 복귀합니다.",
        ],
        rewardItems: [
          {
            name: "청동거울 조각 ⑤번",
            imageUrl: "../images/items/bronze-mirror-fragment-5.jpg",
            description: "대성동 고분군에서 획득한 다섯 번째 청동거울 조각입니다.",
            quantity: 1,
          },
          {
            name: "철제 갑옷",
            imageUrl: "../images/items/gaya-iron-armor.jpg",
            description: "가야 대성동 고분군에서 얻은 사후 세계 물건입니다.",
            quantity: 1,
          },
        ],
      },
      {
        id: "ending-review",
        title: "거울 조각 5번 정리",
        playerRole: "시간 탐험가",
        missionId: "mirror-room",
        stepId: "mirror-pieces",
        nextAction: "청동거울 결합 연출로 이동하세요.",
        lines: [
          "대성동 고분군은 가야의 철과 바다를 말하지!",
        ],
      },
    ],
  },
];

function normalizeTrigger(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  const [trigger] = raw.split("|");
  const normalized = (trigger ?? "").trim();
  return normalized ? normalized : null;
}

function normalizeAliasKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[._]/g, "-")
    .replace(/\s+/g, "");
}

function resolveNpcIdAlias(rawNpcId: string): string {
  const aliasKey = normalizeAliasKey(rawNpcId);
  return NPC_ID_ALIASES[aliasKey] ?? rawNpcId.trim();
}

function resolveSceneIdAlias(npcId: string, rawSceneId: string): string {
  const sceneId = rawSceneId.trim() || DEFAULT_SCENE_ID;
  const aliasKey = normalizeAliasKey(sceneId);
  return NPC_SCENE_ALIASES[npcId]?.[aliasKey] ?? sceneId;
}

function doesNpcMatchCurrentMap(npc: MissionNpcDefinition): boolean {
  const currentMapName = (ScriptMap.name ?? "").trim();
  if (!currentMapName) {
    return false;
  }

  const normalizedCurrentMapName = currentMapName.replace(/\s+/g, "");
  return npc.mapNames.some(function (mapName) {
    const normalizedMapName = mapName.replace(/\s+/g, "");
    return (
      mapName === currentMapName ||
      normalizedMapName === normalizedCurrentMapName
    );
  });
}

function parseSceneOnlyTrigger(sceneInput: string): ParsedNpcTrigger | null {
  if (isGenericSceneOnlyAlias(sceneInput)) {
    return null;
  }

  const currentMapNpcs = MISSION_NPCS.filter(doesNpcMatchCurrentMap);

  for (const npc of currentMapNpcs) {
    const sceneId = resolveSceneIdAlias(npc.id, sceneInput);
    if (getNpcScene(npc, sceneId)) {
      return { npcId: npc.id, sceneId };
    }
  }

  return null;
}

function isGenericSceneOnlyAlias(sceneInput: string): boolean {
  const aliasKey = normalizeAliasKey(sceneInput);

  return (
    /^\d+$/.test(aliasKey) ||
    /^trigger-?\d+$/.test(aliasKey) ||
    /^트리거\d+$/.test(aliasKey)
  );
}

function getNpcLocationAliases(npcId: string): string[] {
  const aliases = new Set<string>([npcId]);

  Object.keys(NPC_ID_ALIASES).forEach(function (alias) {
    if (NPC_ID_ALIASES[alias] === npcId) {
      aliases.add(alias);
    }
  });

  return Array.from(aliases);
}

function getSceneLocationAliases(npcId: string, sceneId: string): string[] {
  const aliases = new Set<string>([sceneId]);
  const sceneAliases = NPC_SCENE_ALIASES[npcId] ?? {};

  Object.keys(sceneAliases).forEach(function (alias) {
    if (sceneAliases[alias] === sceneId) {
      aliases.add(alias);
    }
  });

  return Array.from(aliases);
}

function parseNpcTrigger(raw: unknown): ParsedNpcTrigger | null {
  const normalized = normalizeTrigger(raw);
  if (!normalized) {
    return null;
  }

  const prefix = NPC_TRIGGER_PREFIXES.find(function (candidate) {
    return normalized.startsWith(candidate);
  });

  const body = prefix ? normalized.slice(prefix.length).trim() : normalized;
  if (!body) {
    return null;
  }

  const parts = body.includes(":")
    ? body
        .split(":")
        .map(function (part) {
          return part.trim();
        })
        .filter(Boolean)
    : body
        .split(/\s+/)
        .map(function (part) {
          return part.trim();
        })
        .filter(Boolean);

  const npcId = resolveNpcIdAlias(parts[0] ?? "");
  const sceneInput = parts.slice(1).join("-") || DEFAULT_SCENE_ID;
  const sceneId = resolveSceneIdAlias(npcId, sceneInput);

  if (!getNpcDefinition(npcId) && parts.length === 1) {
    return parseSceneOnlyTrigger(parts[0] ?? "");
  }

  if (!npcId || !sceneId) {
    return null;
  }

  return { npcId, sceneId };
}

function getNpcDefinition(npcId: string): MissionNpcDefinition | null {
  return (
    MISSION_NPCS.find(function (npc) {
      return npc.id === npcId;
    }) ?? null
  );
}

function getNpcScene(
  npc: MissionNpcDefinition,
  sceneId: string
): MissionNpcScene | null {
  return (
    npc.scenes.find(function (scene) {
      return scene.id === sceneId;
    }) ?? null
  );
}

function resolveProgressScene(
  player: ScriptPlayer,
  npc: MissionNpcDefinition,
  scene: MissionNpcScene
): MissionNpcScene {
  if (npc.id === "museum-hou-bronze-bowl" && scene.id === "quiz") {
    const storage = loadPlayerStorage(player);
    const clues = storage.museumClues as string[] | undefined;
    if (!clues || !["gwang", "gae", "to"].every(clue => clues.includes(clue))) {
      return getNpcScene(npc, "intro") ?? scene;
    }
  }
  if (npc.id !== "gwanghoek" || scene.id !== "intro") {
    return scene;
  }

  const shouldOpenIronProduction =
    areMissionStepsComplete(
      player,
      "daeseongdong",
      DAESEONGDONG_IRON_ITEM_STEP_IDS
    );

  if (!shouldOpenIronProduction) {
    return scene;
  }

  return getNpcScene(npc, "iron-production") ?? scene;
}

function pickWidgetDimensions(player: ScriptPlayer): {
  width: number;
  height: number;
} {
  return player.isMobile
    ? MISSION_NPC_WIDGET_DIMENSIONS.mobile
    : MISSION_NPC_WIDGET_DIMENSIONS.desktop;
}

function areMissionStepsComplete(
  player: ScriptPlayer,
  missionId: string,
  stepIds: string[]
): boolean {
  return stepIds.every(function (stepId) {
    return isMissionStepComplete(player, missionId, stepId);
  });
}

function appendSpeakerlessLine(
  scene: MissionNpcScene,
  lineText: string
): MissionNpcScene {
  if (scene.lines.includes(lineText)) {
    return scene;
  }

  return {
    ...scene,
    lines: [...scene.lines, lineText],
    speakerlessLineTexts: [
      ...(scene.speakerlessLineTexts ?? []),
      lineText,
    ],
  };
}

function getDaeseongdongCollectionGuideLine(
  player: ScriptPlayer,
  scene: MissionNpcScene
): string | null {
  if (scene.missionId !== "daeseongdong" || !scene.stepId) {
    return null;
  }

  const tag = preparePlayerTag(player) as MissionNpcPlayerTag;
  const justCompletedAt = Number(tag.missionNpcJustCompletedAt ?? 0);
  const isCurrentNewCompletion =
    tag.missionNpcJustCompletedSceneId === scene.id &&
    tag.missionNpcJustCompletedStepId === scene.stepId &&
    Date.now() - justCompletedAt < 10000;

  if (!isCurrentNewCompletion) {
    return null;
  }

  if (
    DAESEONGDONG_IRON_ITEM_STEP_IDS.includes(scene.stepId) &&
    areMissionStepsComplete(player, "daeseongdong", DAESEONGDONG_IRON_ITEM_STEP_IDS)
  ) {
    return "광획을 다시 찾아가세요.";
  }

  if (
    DAESEONGDONG_ARTIFACT_STEP_IDS.includes(scene.stepId) &&
    areMissionStepsComplete(player, "daeseongdong", DAESEONGDONG_ARTIFACT_STEP_IDS)
  ) {
    return "광획에게 돌아가 철제 유물의 쓰임을 맞혀 보세요.";
  }

  return null;
}

function buildDynamicSceneForPlayer(
  player: ScriptPlayer,
  scene: MissionNpcScene
): MissionNpcScene {
  const daeseongdongGuideLine = getDaeseongdongCollectionGuideLine(player, scene);
  if (daeseongdongGuideLine) {
    return appendSpeakerlessLine(scene, daeseongdongGuideLine);
  }

  return scene;
}

function buildNpcPayload(
  player: ScriptPlayer,
  npc: MissionNpcDefinition,
  scene: MissionNpcScene
): MissionNpcPayload {
  const displayScene = buildDynamicSceneForPlayer(player, scene);
  const speakerLines = displayScene.speakerLines ?? [];
  const speakerlessLineTexts = [
    ...(displayScene.speakerlessLineTexts ?? []),
    ...speakerLines
      .filter(function (line) {
        return line.speakerless === true;
      })
      .map(function (line) {
        return line.text;
      }),
  ];

  return {
    afterRedirectDelayMs: displayScene.afterRedirectDelayMs,
    afterRedirectUrl: displayScene.afterRedirectUrl ?? "",
    autoCompleteFinalLineDelayMs: displayScene.autoCompleteFinalLineDelayMs,
    choices: displayScene.choices ?? [],
    kind: npc.kind,
    lines: speakerLines.length
      ? speakerLines.map(function (line) {
          return line.text;
        })
      : displayScene.lines,
    mapNames: npc.mapNames,
    mediaOverlay: displayScene.mediaOverlay,
    name: displayScene.displayName ?? npc.name,
    nextAction: displayScene.nextAction ?? "",
    npcId: npc.id,
    playerRole: displayScene.playerRole ?? "",
    profileImageUrl: displayScene.displayProfileImageUrl ?? npc.profileImageUrl ?? "",
    role: npc.role,
    sceneId: displayScene.id,
    speakerLines,
    speakerlessLineTexts,
    title: displayScene.title,
  };
}

function sendNpcInit(
  player: ScriptPlayer,
  widget: ScriptWidget | null | undefined,
  npc: MissionNpcDefinition,
  scene: MissionNpcScene
): void {
  if (!widget || typeof widget.sendMessage !== "function") {
    return;
  }

  const message: MissionNpcInitMessage = {
    type: "mission-npc:init",
    payload: buildNpcPayload(player, npc, scene),
  };

  widget.sendMessage(message);
}

function hasVisibleNpcPayload(payload: MissionNpcPayload): boolean {
  return (
    payload.lines.some(function (line) {
      return line.trim().length > 0;
    }) ||
    payload.speakerLines.some(function (line) {
      return line.text.trim().length > 0;
    }) ||
    payload.choices.length > 0 ||
    !!payload.mediaOverlay
  );
}

function teardownMissionNpcWidget(tag: MissionNpcPlayerTag): void {
  const existing = tag.missionNpcWidget;
  tag.missionNpcWidget = null;
  tag.missionNpcWidgetTemplate = undefined;
  tag.missionNpcId = undefined;
  tag.missionNpcSceneId = undefined;
  tag.missionNpcLastAdvanceAt = undefined;
  tag.missionNpcReadyAt = undefined;
  tag.missionNpcRetryCount = undefined;

  if (existing && typeof existing.destroy === "function") {
    existing.destroy();
  }
}

function scheduleNpcReadyRetry(
  player: ScriptPlayer,
  npc: MissionNpcDefinition,
  scene: MissionNpcScene,
  retryCountAtOpen: number
): void {
  if (retryCountAtOpen > 0) {
    return;
  }

  setTimeout(function () {
    const tag = preparePlayerTag(player) as MissionNpcPlayerTag;
    if (
      tag.missionNpcId !== npc.id ||
      tag.missionNpcSceneId !== scene.id ||
      tag.missionNpcReadyAt ||
      Number(tag.missionNpcRetryCount ?? 0) !== retryCountAtOpen
    ) {
      return;
    }

    const existing = tag.missionNpcWidget;
    tag.missionNpcWidget = null;
    tag.missionNpcId = undefined;
    tag.missionNpcSceneId = undefined;
    tag.missionNpcReadyAt = undefined;
    tag.missionNpcRetryCount = retryCountAtOpen + 1;
    if (existing && typeof existing.destroy === "function") {
      existing.destroy();
    }

    openMissionNpc(player, npc, scene);
  }, MISSION_NPC_READY_RETRY_MS);
}

export function requestMissionNpcAdvance(player: ScriptPlayer): boolean {
  const tag = preparePlayerTag(player) as MissionNpcPlayerTag;
  const widget = tag.missionNpcWidget;
  if (!widget || typeof widget.sendMessage !== "function") {
    return false;
  }

  const now = Date.now();
  const lastAdvanceAt = Number(tag.missionNpcLastAdvanceAt ?? 0);
  if (now - lastAdvanceAt < MISSION_NPC_ADVANCE_DEDUP_MS) {
    return true;
  }

  tag.missionNpcLastAdvanceAt = now;
  const message: MissionNpcAdvanceMessage = {
    type: "mission-npc:advance-request",
  };
  widget.sendMessage(message);
  return true;
}

function markSceneProgress(
  player: ScriptPlayer,
  scene: MissionNpcScene
): void {
  if (scene.missionId && scene.stepIds?.length) {
    scene.stepIds.forEach(function (stepId) {
      markMissionStepComplete(player, scene.missionId as string, stepId);
    });
  }

  if (!scene.missionId || !scene.stepId) {
    return;
  }

  const wasStepComplete = isMissionStepComplete(
    player,
    scene.missionId,
    scene.stepId
  );
  markMissionStepComplete(player, scene.missionId, scene.stepId);

  const tag = preparePlayerTag(player) as MissionNpcPlayerTag;
  if (wasStepComplete) {
    tag.missionNpcJustCompletedAt = undefined;
    tag.missionNpcJustCompletedSceneId = undefined;
    tag.missionNpcJustCompletedStepId = undefined;
    return;
  }

  tag.missionNpcJustCompletedAt = Date.now();
  tag.missionNpcJustCompletedSceneId = scene.id;
  tag.missionNpcJustCompletedStepId = scene.stepId;
}

function areSceneRequirementsComplete(
  player: ScriptPlayer,
  scene: MissionNpcScene
): boolean {
  const requirements = scene.requiresCompletedSteps;
  if (!requirements) {
    return true;
  }

  return requirements.stepIds.every(function (stepId) {
    return isMissionStepComplete(player, requirements.missionId, stepId);
  });
}

function showSceneRequirementMessage(
  player: ScriptPlayer,
  scene: MissionNpcScene
): void {
  player.showCenterLabel(
    scene.requiresCompletedSteps?.message ?? "미션을 모두 수행하고 이동하세요.",
    0xffffff,
    0x000000,
    420,
    3000
  );
  player.sendUpdated();
}

function grantSceneRewardItems(
  player: ScriptPlayer,
  scene: MissionNpcScene
): void {
  if (!scene.rewardItems?.length) {
    return;
  }

  scene.rewardItems.forEach(function (item) {
    addInventoryItem(player, item);
  });
  refreshInventoryWidget(player);
  player.sendUpdated();
}

function getRestorableMoveSpeed(player: ScriptPlayer): number {
  const speed = Number(player.moveSpeed);
  return Number.isFinite(speed) && speed > 0
    ? speed
    : DEFAULT_PLAYER_MOVE_SPEED;
}

function ensureMissionNpcStorageState(
  storage: MissionNpcStorage
): NonNullable<MissionNpcStorage["missionNpc"]> {
  if (
    !storage.missionNpc ||
    typeof storage.missionNpc !== "object" ||
    Array.isArray(storage.missionNpc)
  ) {
    storage.missionNpc = { seenSceneKeys: [] };
    return storage.missionNpc;
  }

  if (!Array.isArray(storage.missionNpc.seenSceneKeys)) {
    storage.missionNpc.seenSceneKeys = [];
  }

  return storage.missionNpc;
}

function getOnceSceneKey(
  npc: MissionNpcDefinition,
  scene: MissionNpcScene
): string {
  return `${npc.id}:${scene.id}`;
}

function isSameNpcScene(
  tag: MissionNpcPlayerTag,
  npc: MissionNpcDefinition,
  scene: MissionNpcScene
): boolean {
  return tag.missionNpcId === npc.id && tag.missionNpcSceneId === scene.id;
}

function isSceneOpenOrPending(
  tag: MissionNpcPlayerTag,
  npc: MissionNpcDefinition,
  scene: MissionNpcScene
): boolean {
  if (tag.missionNpcWidget && isSameNpcScene(tag, npc, scene)) {
    return true;
  }

  const sceneKey = getOnceSceneKey(npc, scene);
  return (
    tag.missionNpcPreDialogueCameraKey === sceneKey &&
    Number(tag.missionNpcPreDialogueCameraUntil ?? 0) > Date.now()
  );
}

function hasSeenOncePerPlayerScene(
  player: ScriptPlayer,
  npc: MissionNpcDefinition,
  scene: MissionNpcScene
): boolean {
  if (!scene.oncePerPlayer) {
    return false;
  }

  const storage = loadPlayerStorage<MissionNpcStorage>(player, {
    missionNpc: { seenSceneKeys: [] },
  });
  const missionNpcStorage = ensureMissionNpcStorageState(storage);
  return missionNpcStorage.seenSceneKeys?.includes(getOnceSceneKey(npc, scene)) === true;
}

function markOncePerPlayerSceneSeen(
  player: ScriptPlayer,
  npc: MissionNpcDefinition,
  scene: MissionNpcScene
): void {
  if (!scene.oncePerPlayer) {
    return;
  }

  const storage = loadPlayerStorage<MissionNpcStorage>(player, {
    missionNpc: { seenSceneKeys: [] },
  });
  const missionNpcStorage = ensureMissionNpcStorageState(storage);
  const seenSceneKeys = missionNpcStorage.seenSceneKeys ?? [];
  const sceneKey = getOnceSceneKey(npc, scene);

  if (!seenSceneKeys.includes(sceneKey)) {
    seenSceneKeys.push(sceneKey);
  }

  missionNpcStorage.seenSceneKeys = seenSceneKeys;
  savePlayerStorage(player, storage, { persist: true });
}

export function resetMissionNpcOncePerPlayerScenes(
  player: ScriptPlayer
): void {
  const storage = loadPlayerStorage<MissionNpcStorage>(player, {
    missionNpc: { seenSceneKeys: [] },
  });
  const missionNpcStorage = ensureMissionNpcStorageState(storage);
  missionNpcStorage.seenSceneKeys = [];
  savePlayerStorage(player, storage, { persist: true });

  const tag = preparePlayerTag(player) as MissionNpcPlayerTag;
  if (tag.missionNpcPreDialogueCameraKey) {
    tag.missionNpcPreDialogueCameraKey = undefined;
    tag.missionNpcPreDialogueCameraUntil = undefined;
    player.setCameraTarget("");
  }
}

function getCurrentScene(
  tag: MissionNpcPlayerTag,
  fallbackNpc: MissionNpcDefinition,
  fallbackScene: MissionNpcScene
): MissionNpcScene | null {
  const currentNpc = getNpcDefinition(tag.missionNpcId ?? fallbackNpc.id);
  if (!currentNpc) {
    return fallbackScene;
  }

  return getNpcScene(currentNpc, tag.missionNpcSceneId ?? fallbackScene.id);
}

function runSceneAfterAction(
  player: ScriptPlayer,
  scene: MissionNpcScene | null
): void {
  if (scene?.museumTransitionId) {
    handleMuseumAction(player, scene.museumTransitionId, handleMissionNpcTrigger);
  }
  const afterMapTeleport = scene?.afterMapTeleport;
  if (afterMapTeleport) {
    setTimeout(function () {
      player.spawnAtMap(
        afterMapTeleport.spaceHashId ?? ScriptApp.spaceHashID,
        afterMapTeleport.mapHashId
      );
    }, afterMapTeleport.delayMs ?? 0);
  }

  const afterNpcTrigger = scene?.afterNpcTrigger;
  if (afterNpcTrigger) {
    setTimeout(function () {
      handleMissionNpcTrigger(player, afterNpcTrigger);
    }, 350);
  }

  if (scene?.afterShowMissionProgress) {
    setTimeout(function () {
      showMissionProgress(player, ScriptMap.name);
    }, 450);
  }

  const afterGameTrigger = scene?.afterGameTrigger;
  if (!afterGameTrigger) {
    return;
  }

  const requirements = scene?.afterGameRequiresSteps;
  if (requirements) {
    const isReady = requirements.stepIds.every(function (stepId) {
      return isMissionStepComplete(player, requirements.missionId, stepId);
    });

    if (!isReady) {
      player.showCenterLabel(
        requirements.message ?? "필요한 단계를 모두 완료한 뒤 다시 시도하세요.",
        0xffffff,
        0x000000,
        420,
        3000
      );
      player.sendUpdated();
      return;
    }
  }

  setTimeout(function () {
    handleMissionGameTrigger(player, afterGameTrigger);
  }, player.isMobile ? 650 : 350);
}

function runSceneImmediateAction(
  player: ScriptPlayer,
  scene: MissionNpcScene
): boolean {
  const toastMessage = scene.toastMessage;
  if (toastMessage?.text) {
    player.showCenterLabel(
      toastMessage.text,
      0xffffff,
      0x000000,
      520,
      toastMessage.durationMs ?? 5000
    );
  }

  const cameraFocus = scene.cameraFocus;
  if (cameraFocus) {
    player.setCameraTarget(
      cameraFocus.x,
      cameraFocus.y,
      cameraFocus.moveDuration ?? 0.45
    );
    player.sendUpdated();

    setTimeout(function () {
      player.setCameraTarget("");
      player.sendUpdated();
    }, cameraFocus.durationMs ?? 3000);
  }

  return scene.skipWidget === true;
}

function runScenePreDialogueCamera(
  player: ScriptPlayer,
  npc: MissionNpcDefinition,
  scene: MissionNpcScene
): boolean {
  const cameraFocus = scene.preDialogueCameraFocus;
  if (!cameraFocus) {
    return false;
  }

  const tag = preparePlayerTag(player) as MissionNpcPlayerTag;
  const cameraKey = `${npc.id}:${scene.id}`;
  const now = Date.now();
  if (
    tag.missionNpcPreDialogueCameraKey === cameraKey &&
    Number(tag.missionNpcPreDialogueCameraUntil ?? 0) > now
  ) {
    return true;
  }

  const durationMs = cameraFocus.durationMs ?? 3000;
  const shouldLockMovement = cameraFocus.lockMovement !== false;
  const restoreMoveSpeed = getRestorableMoveSpeed(player);

  tag.missionNpcPreDialogueCameraKey = cameraKey;
  tag.missionNpcPreDialogueCameraUntil = now + durationMs;

  if (shouldLockMovement) {
    player.moveSpeed = 0;
  }
  player.setCameraTarget(
    cameraFocus.x,
    cameraFocus.y,
    cameraFocus.moveDuration ?? 0.45
  );
  player.sendUpdated();

  setTimeout(function () {
    const latestTag = preparePlayerTag(player) as MissionNpcPlayerTag;
    if (latestTag.missionNpcPreDialogueCameraKey === cameraKey) {
      latestTag.missionNpcPreDialogueCameraKey = undefined;
      latestTag.missionNpcPreDialogueCameraUntil = undefined;
    }

    player.setCameraTarget("");
    if (shouldLockMovement) {
      player.moveSpeed = restoreMoveSpeed;
    }
    player.sendUpdated();
    openMissionNpc(player, npc, scene);
  }, durationMs);

  return true;
}

function runSceneOpenAction(
  player: ScriptPlayer,
  scene: MissionNpcScene
): void {
  const afterTeleport = scene.afterTeleport;
  if (!afterTeleport) {
    return;
  }

  setTimeout(function () {
    player.spawnAt(afterTeleport.x, afterTeleport.y);
    player.sendUpdated();
  }, afterTeleport.delayMs ?? 1000);
}

function runChoiceAfterAction(
  player: ScriptPlayer,
  choice: MissionNpcChoice | undefined
): void {
  const afterTeleport = choice?.afterTeleport;
  if (!afterTeleport) {
    return;
  }

  setTimeout(function () {
    player.spawnAt(afterTeleport.x, afterTeleport.y);
    player.sendUpdated();
  }, afterTeleport.delayMs ?? 1000);
}

function openMissionNpc(
  player: ScriptPlayer,
  npc: MissionNpcDefinition,
  scene: MissionNpcScene
): ScriptWidget | null {
  if (npc.id.startsWith("museum-")) closeMuseumGame(player);
  markSceneProgress(player, scene);
  runSceneOpenAction(player, scene);

  const tag = preparePlayerTag(player) as MissionNpcPlayerTag;
  const payload = buildNpcPayload(player, npc, scene);

  if (!hasVisibleNpcPayload(payload)) {
    teardownMissionNpcWidget(tag);
    return null;
  }

  const template = npc.id.startsWith("museum-")
    ? MUSEUM_NPC_WIDGET_TEMPLATE
    : MISSION_NPC_WIDGET_TEMPLATE;
  if (tag.missionNpcWidget && tag.missionNpcWidgetTemplate !== template) {
    teardownMissionNpcWidget(tag);
  }

  if (tag.missionNpcWidget) {
    if (isSameNpcScene(tag, npc, scene)) {
      sendNpcInit(player, tag.missionNpcWidget, npc, scene);
      return tag.missionNpcWidget;
    }

    tag.missionNpcId = npc.id;
    tag.missionNpcSceneId = scene.id;
    tag.missionNpcReadyAt = Date.now();
    sendNpcInit(player, tag.missionNpcWidget, npc, scene);
    return tag.missionNpcWidget;
  }

  const retryCountAtOpen = Number(tag.missionNpcRetryCount ?? 0);
  const { width, height } = pickWidgetDimensions(player);
  const widget = player.showWidget(
    template,
    "middle",
    width,
    height
  );

  tag.missionNpcWidget = widget;
  tag.missionNpcWidgetTemplate = template;
  tag.missionNpcId = npc.id;
  tag.missionNpcSceneId = scene.id;
  tag.missionNpcReadyAt = undefined;
  tag.missionNpcRetryCount = retryCountAtOpen;

  widget.onMessage.Add(function (_sender, data) {
    if (tag.missionNpcWidget !== widget) {
      return;
    }
    const type = (data as MissionNpcIncomingMessage | undefined)?.type;

    if (type === "mission-npc:close") {
      preparePlayerTag(player).museumAnsweredQuiz = undefined;
      teardownMissionNpcWidget(tag);
      return;
    }

    if (type === "mission-npc:complete") {
      const completedScene = getCurrentScene(tag, npc, scene);
      if (completedScene) {
        grantSceneRewardItems(player, completedScene);
      }
      teardownMissionNpcWidget(tag);
      runSceneAfterAction(player, completedScene);
      return;
    }

    if (type === "mission-npc:choice") {
      const currentScene = getCurrentScene(tag, npc, scene);
      const choiceId = (data as MissionNpcIncomingMessage | undefined)?.choiceId;
      const selectedChoice = currentScene?.choices?.find(function (choice) {
        return choice.id === choiceId;
      });
      if (currentScene?.museumQuizId && selectedChoice && typeof selectedChoice.museumQuizIndex === "number") {
        handleMuseumDialogueChoice(player, currentScene.museumQuizId, selectedChoice.museumQuizIndex);
      }

      if (selectedChoice?.missionId && selectedChoice.stepId) {
        markMissionStepComplete(
          player,
          selectedChoice.missionId,
          selectedChoice.stepId
        );
      }
      runChoiceAfterAction(player, selectedChoice);
      return;
    }

    if (type === "mission-npc:ready") {
      tag.missionNpcReadyAt = Date.now();
      const currentNpc = getNpcDefinition(tag.missionNpcId ?? npc.id);
      if (!currentNpc) {
        return;
      }

      const currentScene = getNpcScene(
        currentNpc,
        tag.missionNpcSceneId ?? scene.id
      );
      if (!currentScene) {
        return;
      }

      sendNpcInit(player, widget, currentNpc, currentScene);
    }
  });

  sendNpcInit(player, widget, npc, scene);
  scheduleNpcReadyRetry(player, npc, scene, retryCountAtOpen);
  return widget;
}

export function handleMissionNpcTrigger(
  player: ScriptPlayer,
  rawTrigger: unknown
): boolean {
  const parsed = parseNpcTrigger(rawTrigger);
  if (!parsed) {
    return false;
  }

  const npc = getNpcDefinition(parsed.npcId);
  if (!npc) {
    return false;
  }

  const requestedScene = getNpcScene(npc, resolveMuseumSceneId(player, npc.id, parsed.sceneId));
  if (!requestedScene) {
    return false;
  }
  const scene = resolveProgressScene(player, npc, requestedScene);

  if (npc.id === "museum-hou-bronze-bowl" && scene.id.indexOf("clue-") === 0) {
    const clue = scene.id.slice(6);
    let storage: Record<string, unknown> = {};
    try { storage = player.storage ? JSON.parse(player.storage) as Record<string, unknown> : {}; } catch (_error) { storage = {}; }
    const clues = Array.isArray(storage.museumClues) ? storage.museumClues as string[] : [];
    if (!clues.includes(clue)) {
      player.storage = JSON.stringify({ ...storage, museumClues: [...clues, clue] });
      if (typeof player.save === "function") player.save();
    }
  }

  const tag = preparePlayerTag(player) as MissionNpcPlayerTag;
  if (isSceneOpenOrPending(tag, npc, scene)) {
    return true;
  }

  if (!areSceneRequirementsComplete(player, scene)) {
    showSceneRequirementMessage(player, scene);
    return true;
  }

  if (hasSeenOncePerPlayerScene(player, npc, scene)) {
    return true;
  }
  markOncePerPlayerSceneSeen(player, npc, scene);

  if (runSceneImmediateAction(player, scene)) {
    return true;
  }

  if (runScenePreDialogueCamera(player, npc, scene)) {
    return true;
  }

  openMissionNpc(player, npc, scene);
  return true;
}

export function handleMissionNpcObjectKey(
  player: ScriptPlayer,
  key: unknown
): boolean {
  const parsed = parseNpcTrigger(key);
  if (!parsed) {
    return false;
  }

  const npc = getNpcDefinition(parsed.npcId);
  const requestedScene = npc ? getNpcScene(npc, resolveMuseumSceneId(player, npc.id, parsed.sceneId)) : null;
  const targetScene = npc && requestedScene
    ? resolveProgressScene(player, npc, requestedScene)
    : null;
  const targetSceneId = targetScene?.id ?? parsed.sceneId;

  const tag = preparePlayerTag(player) as MissionNpcPlayerTag;
  if (tag.missionNpcWidget) {
    if (
      tag.missionNpcId !== parsed.npcId ||
      tag.missionNpcSceneId !== targetSceneId
    ) {
      return handleMissionNpcTrigger(player, key);
    }

    return requestMissionNpcAdvance(player);
  }

  return handleMissionNpcTrigger(player, key);
}

function addNpcLocationTrigger(locationName: string): void {
  if (registeredMissionNpcLocationNames.has(locationName)) {
    return;
  }

  registeredMissionNpcLocationNames.add(locationName);
  ScriptApp.addOnLocationEnter(locationName, function (player: ScriptPlayer) {
    handleMissionNpcTrigger(player, locationName);
  });
  ScriptApp.addOnLocationTouched(locationName, function (player: ScriptPlayer) {
    handleMissionNpcTrigger(player, locationName);
  });
}

export function handleNearbyMissionNpcLocation(
  player: ScriptPlayer,
  radius = 1
): boolean {
  const locationName = findNearbyLocationName(
    player,
    registeredMissionNpcLocationNames,
    radius
  );

  return locationName ? handleMissionNpcTrigger(player, locationName) : false;
}

export function registerMissionNpcLocations(): void {
  MISSION_NPCS.forEach(function (npc) {
    const locationNames = new Set<string>();
    const bareSceneLocationNames = new Set<string>();
    const npcAliases = getNpcLocationAliases(npc.id);

    npcAliases.forEach(function (npcAlias) {
      locationNames.add(npcAlias);
      npc.scenes.forEach(function (scene) {
        getSceneLocationAliases(npc.id, scene.id).forEach(function (sceneAlias) {
          locationNames.add(`${npcAlias}:${sceneAlias}`);
          if (!isGenericSceneOnlyAlias(sceneAlias)) {
            bareSceneLocationNames.add(sceneAlias);
          }
        });
      });
    });

    NPC_TRIGGER_PREFIXES.forEach(function (prefix) {
      Array.from(locationNames).forEach(function (locationName) {
        addNpcLocationTrigger(`${prefix}${locationName}`);
      });
    });

    Array.from(locationNames).forEach(addNpcLocationTrigger);
    Array.from(bareSceneLocationNames).forEach(addNpcLocationTrigger);
  });
}
