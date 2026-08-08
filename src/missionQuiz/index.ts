import type { ScriptPlayer, ScriptWidget } from "zep-script";

import {
  markMissionStepComplete,
  showMissionProgress,
} from "../missionProgress";
import { findNearbyLocationName } from "../utils/location";
import {
  type PlayerTagRecord,
  preparePlayerTag,
} from "../utils/player";

const MISSION_QUIZ_WIDGET_TEMPLATE = "html/mission-quiz-widget.html";

const MISSION_QUIZ_WIDGET_DIMENSIONS = Object.freeze({
  desktop: { width: 460, height: 430 },
  mobile: { width: 330, height: 470 },
});

const QUIZ_TRIGGER_PREFIXES = ["quiz:", "qz:"] as const;
const registeredMissionQuizLocationNames = new Set<string>();

interface MissionQuizOption {
  text: string;
}

interface MissionQuizDefinition {
  id: string;
  title: string;
  question: string;
  options: MissionQuizOption[];
  correctIndex: number;
  successMessage: string;
  retryMessage: string;
  explanation: string;
  missionId: string;
  stepId: string;
}

type MissionQuizPlayerTag = PlayerTagRecord & {
  missionQuizWidget?: ScriptWidget | null;
  missionQuizId?: string;
};

interface MissionQuizIncomingMessage {
  optionIndex?: number;
  type?: string;
}

interface MissionQuizPayload {
  explanation: string;
  id: string;
  options: string[];
  question: string;
  title: string;
}

interface MissionQuizResultPayload {
  correct: boolean;
  message: string;
  explanation: string;
  selectedIndex: number;
}

interface MissionQuizInitMessage {
  type: "mission-quiz:init";
  payload: MissionQuizPayload;
}

interface MissionQuizResultMessage {
  type: "mission-quiz:result";
  payload: MissionQuizResultPayload;
}

const MISSION_QUIZZES: MissionQuizDefinition[] = [
  {
    id: "anak-final",
    title: "안악 3호분 최종 퀴즈",
    question: "대행렬도에서 가장 크게 그려진 인물은 누구인가요?",
    options: [
      { text: "무덤 주인" },
      { text: "견마잡이" },
      { text: "시종" },
      { text: "말" },
    ],
    correctIndex: 0,
    successMessage: "정답입니다. 위계적 표현법을 잘 찾았어요.",
    retryMessage: "다시 생각해볼까요? 가장 크게 표현된 인물을 찾아보세요.",
    explanation: "고구려 고분 벽화에서는 중요한 인물을 크게 그려 신분과 위계를 표현했습니다.",
    missionId: "anak-3",
    stepId: "final-quiz",
  },
  {
    id: "muyongchong-final",
    title: "무용총 최종 퀴즈",
    question: "고구려가 처음 불교를 받아들인 왕은 누구인가요?",
    options: [
      { text: "광개토대왕" },
      { text: "소수림왕" },
      { text: "장수왕" },
    ],
    correctIndex: 1,
    successMessage: "정답입니다. 소수림왕이 불교를 받아들였지요.",
    retryMessage: "아까 바닥 돌판의 372년 힌트를 다시 떠올려보세요.",
    explanation: "소수림왕은 불교 수용과 태학 설립으로 고구려 국가 체제를 정비했습니다.",
    missionId: "muyongchong",
    stepId: "final-quiz",
  },
  {
    id: "muryeong-tomb-final",
    title: "무령왕릉 최종 퀴즈",
    question: "백제가 웅진으로 천도하기 이전의 수도는 어디였나요?",
    options: [
      { text: "한성" },
      { text: "사비" },
      { text: "국내성" },
      { text: "금성" },
    ],
    correctIndex: 0,
    successMessage: "정답입니다. 웅진 이전 백제의 수도는 한성이었습니다.",
    retryMessage: "백제의 수도 이동 순서를 떠올려보세요.",
    explanation: "백제는 한성에서 웅진으로, 이후 사비로 수도를 옮겼습니다.",
    missionId: "muryeong-tomb",
    stepId: "final-quiz",
  },
  {
    id: "cheonmachong-final",
    title: "천마총 최종 퀴즈",
    question: "돌무지덧널무덤이 도굴되기 어려운 까닭은 무엇인가요?",
    options: [
      { text: "나무 덧널 위에 돌을 두껍게 쌓았기 때문" },
      { text: "입구가 항상 열려 있었기 때문" },
      { text: "벽돌을 아치형으로 쌓았기 때문" },
      { text: "무덤 안에 물길을 만들었기 때문" },
    ],
    correctIndex: 0,
    successMessage: "정답입니다. 돌무지가 내부 접근을 어렵게 만들었습니다.",
    retryMessage: "천마총의 구조를 순서대로 떠올려보세요.",
    explanation: "신라 돌무지덧널무덤은 나무 덧널을 만들고 돌을 두껍게 쌓은 뒤 흙으로 덮었습니다.",
    missionId: "cheonmachong",
    stepId: "final-quiz",
  },
  {
    id: "daeseongdong-final",
    title: "대성동 고분군 최종 퀴즈",
    question: "가야가 '철의 왕국'으로 불린 까닭은 무엇인가요?",
    options: [
      { text: "질 좋은 철을 생산하고 교역했기 때문" },
      { text: "금관을 가장 많이 만들었기 때문" },
      { text: "불교 사원을 많이 세웠기 때문" },
      { text: "벽돌무덤을 만들었기 때문" },
    ],
    correctIndex: 0,
    successMessage: "정답입니다. 가야의 철 생산과 교역이 핵심입니다.",
    retryMessage: "대성동 고분군의 철제 유물과 해상 교역을 떠올려보세요.",
    explanation: "가야는 철 생산 기술과 교역을 바탕으로 다양한 철제 유물을 남겼습니다.",
    missionId: "daeseongdong",
    stepId: "final-quiz",
  },
];

function normalizeQuizId(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  const [trigger] = raw.split("|");
  const normalized = (trigger ?? "").trim();
  if (!normalized) {
    return null;
  }

  const prefix = QUIZ_TRIGGER_PREFIXES.find(function (candidate) {
    return normalized.startsWith(candidate);
  });

  if (!prefix) {
    return null;
  }

  const quizId = normalized.slice(prefix.length).trim();
  return quizId ? quizId : null;
}

function getQuizDefinition(quizId: string): MissionQuizDefinition | null {
  return (
    MISSION_QUIZZES.find(function (quiz) {
      return quiz.id === quizId;
    }) ?? null
  );
}

function pickWidgetDimensions(player: ScriptPlayer): {
  width: number;
  height: number;
} {
  return player.isMobile
    ? MISSION_QUIZ_WIDGET_DIMENSIONS.mobile
    : MISSION_QUIZ_WIDGET_DIMENSIONS.desktop;
}

function buildQuizPayload(quiz: MissionQuizDefinition): MissionQuizPayload {
  return {
    explanation: quiz.explanation,
    id: quiz.id,
    options: quiz.options.map(function (option) {
      return option.text;
    }),
    question: quiz.question,
    title: quiz.title,
  };
}

function sendQuizInit(
  widget: ScriptWidget | null | undefined,
  quiz: MissionQuizDefinition
): void {
  if (!widget || typeof widget.sendMessage !== "function") {
    return;
  }

  const message: MissionQuizInitMessage = {
    type: "mission-quiz:init",
    payload: buildQuizPayload(quiz),
  };

  widget.sendMessage(message);
}

function sendQuizResult(
  widget: ScriptWidget | null | undefined,
  payload: MissionQuizResultPayload
): void {
  if (!widget || typeof widget.sendMessage !== "function") {
    return;
  }

  const message: MissionQuizResultMessage = {
    type: "mission-quiz:result",
    payload,
  };

  widget.sendMessage(message);
}

function teardownMissionQuizWidget(tag: MissionQuizPlayerTag): void {
  const existing = tag.missionQuizWidget;
  tag.missionQuizWidget = null;
  tag.missionQuizId = undefined;

  if (existing && typeof existing.destroy === "function") {
    existing.destroy();
  }
}

function handleQuizAnswer(
  player: ScriptPlayer,
  widget: ScriptWidget,
  quiz: MissionQuizDefinition,
  optionIndex: number
): void {
  const selectedIndex = Number.isFinite(optionIndex)
    ? Math.floor(optionIndex)
    : -1;
  const correct = selectedIndex === quiz.correctIndex;

  if (correct) {
    markMissionStepComplete(player, quiz.missionId, quiz.stepId);
  }

  sendQuizResult(widget, {
    correct,
    explanation: quiz.explanation,
    message: correct ? quiz.successMessage : quiz.retryMessage,
    selectedIndex,
  });
}

function openMissionQuiz(
  player: ScriptPlayer,
  quiz: MissionQuizDefinition
): ScriptWidget | null {
  const tag = preparePlayerTag(player) as MissionQuizPlayerTag;

  if (tag.missionQuizWidget) {
    tag.missionQuizId = quiz.id;
    sendQuizInit(tag.missionQuizWidget, quiz);
    return tag.missionQuizWidget;
  }

  const { width, height } = pickWidgetDimensions(player);
  const widget = player.showWidget(
    MISSION_QUIZ_WIDGET_TEMPLATE,
    "middle",
    width,
    height
  );

  tag.missionQuizWidget = widget;
  tag.missionQuizId = quiz.id;

  widget.onMessage.Add(function (_sender, data) {
    const message = data as MissionQuizIncomingMessage | undefined;
    const type = message?.type;

    if (type === "mission-quiz:close") {
      teardownMissionQuizWidget(tag);
      return;
    }

    const currentQuiz = getQuizDefinition(tag.missionQuizId ?? quiz.id);
    if (!currentQuiz) {
      return;
    }

    if (type === "mission-quiz:ready") {
      sendQuizInit(widget, currentQuiz);
      return;
    }

    if (type === "mission-quiz:answer") {
      handleQuizAnswer(player, widget, currentQuiz, message?.optionIndex ?? -1);
      return;
    }

    if (type === "mission-quiz:show-progress") {
      showMissionProgress(player, ScriptMap.name);
    }
  });

  sendQuizInit(widget, quiz);
  return widget;
}

export function handleMissionQuizTrigger(
  player: ScriptPlayer,
  rawTrigger: unknown
): boolean {
  const quizId = normalizeQuizId(rawTrigger);
  if (!quizId) {
    return false;
  }

  const quiz = getQuizDefinition(quizId);
  if (!quiz) {
    return false;
  }

  openMissionQuiz(player, quiz);
  return true;
}

export function handleMissionQuizObjectKey(
  player: ScriptPlayer,
  key: unknown
): boolean {
  return handleMissionQuizTrigger(player, key);
}

function addMissionQuizLocationTrigger(locationName: string): void {
  if (registeredMissionQuizLocationNames.has(locationName)) {
    return;
  }

  registeredMissionQuizLocationNames.add(locationName);
  ScriptApp.addOnLocationEnter(locationName, function (player: ScriptPlayer) {
    handleMissionQuizTrigger(player, locationName);
  });
  ScriptApp.addOnLocationTouched(locationName, function (player: ScriptPlayer) {
    handleMissionQuizTrigger(player, locationName);
  });
}

export function handleNearbyMissionQuizLocation(
  player: ScriptPlayer,
  radius = 1
): boolean {
  const locationName = findNearbyLocationName(
    player,
    registeredMissionQuizLocationNames,
    radius
  );

  return locationName ? handleMissionQuizTrigger(player, locationName) : false;
}

export function registerMissionQuizLocations(): void {
  MISSION_QUIZZES.forEach(function (quiz) {
    QUIZ_TRIGGER_PREFIXES.forEach(function (prefix) {
      addMissionQuizLocationTrigger(`${prefix}${quiz.id}`);
    });
  });
}
