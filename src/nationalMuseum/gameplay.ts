import type { ScriptPlayer, ScriptWidget } from "zep-script";
import { loadPlayerStorage, preparePlayerStorage, preparePlayerTag, savePlayerStorage } from "../utils/player";
import { GAME_IDS, createGameState, applyGameAction, gameView, GameState, GameAction } from "./games";
import { MUSEUM_MAPS, MISSIONS, journey, saveMuseumStory, handleMuseumArrival, handleMuseumMissionCompletion, runMuseumSceneTransition } from "./navigation";
import { nearbyMuseumNpc } from "./exploration";
import { closeMuseumProgress, refreshMuseumProgress } from "./progress";
import { recordMuseumGayaClue } from "./exploration";

type Open = (player: ScriptPlayer, trigger: string) => unknown;
type Session = { widget: ScriptWidget; id: string; token: string; revision: number; promptOpen?: boolean };
type MuseumTag = { museumGame?: Session; museumHud?: ScriptWidget; museumArrival?: boolean; missionNpcWidget?: ScriptWidget };
const BAEKJE_BRICK_IDS = ["yeondaegwi", "sansu", "waun", "sansubonghwang", "bonghwang", "sansugwi", "banryong", "yeonhwa"];
function tag(player: ScriptPlayer): MuseumTag { return preparePlayerTag(player) as MuseumTag; }
function saveGame(player: ScriptPlayer, id: string, state: GameState): void {
  const data = loadPlayerStorage(player);
  const games = (data.museumGames || {}) as Record<string, GameState>;
  games[id] = state;
  savePlayerStorage(player, { ...data, museumGames: games }, { persist: true });
}
function readGame(player: ScriptPlayer, id: string): GameState {
  const games = loadPlayerStorage(player).museumGames as Record<string, GameState> | undefined;
  const state = games?.[id] || createGameState();
  if (id === GAME_IDS[4] && state.stage === 0 && state.order.length !== 6) state.order = [3, 0, 5, 1, 2, 4];
  return state;
}
export function closeMuseumGame(player: ScriptPlayer): void {
  const t = tag(player);
  if (t.museumGame) { t.museumGame.widget.destroy(); t.museumGame = undefined; }
}
function canPlay(_player: ScriptPlayer, index: number): boolean {
  // Every exhibition room has a shareable direct URL. Keep the mission bound
  // to its room, but never require visitors (or on-site testers) to enter
  // through the preceding lobby before its interactions can work.
  return ScriptApp.spaceHashID === "nLP9zE" && ScriptApp.mapHashID === MISSIONS[index].map;
}
export function openMuseumGame(player: ScriptPlayer, id: string, open: Open): void {
  const index = GAME_IDS.indexOf(id);
  if (index < 0 || !canPlay(player, index)) { player.showCenterLabel("해당 전시실의 NPC 가까이에서 미션을 진행해 주세요."); return; }
  const progress = journey(player);
  if (progress.completed.includes(id)) { continueMuseum(player, open); return; }
  if (index === 2 || index === 3) {
    closeMuseumGame(player);
    preparePlayerTag(player).museumAnsweredQuiz = undefined;
    open(player, `npc:${MISSIONS[index].npc}:quiz`);
    return;
  }
  if (id === GAME_IDS[6] && progress.story !== "emergency") { open(player, "npc:museum-guide-robot:meeting"); return; }
  closeMuseumGame(player);
  const widget = player.showWidget("html/museum-game-v1.html", "middle", player.isMobile ? 340 : 740, player.isMobile ? 520 : 590);
  const session: Session = { widget, id, token: String(Date.now()) + "-" + String(Math.random()), revision: 0 };
  tag(player).museumGame = session;
  saveGame(player, id, readGame(player, id));
  const send = (): void => widget.sendMessage({ type: "museum:game", token: session.token, revision: session.revision, mobile: player.isMobile, ...gameView(id, readGame(player, id)) });
  widget.onMessage.Add(function (_sender, raw) {
    if (tag(player).museumGame !== session || !canPlay(player, index)) return;
    const message = raw as { type?: string; token?: string; revision?: number; action?: GameAction };
    if (message?.type === "museum:ready") { send(); return; }
    if (message?.token !== session.token) return;
    if (message.type === "museum:close") { closeMuseumGame(player); return; }
    if (message.type === "museum:input" && player.isMobile && id === GAME_IDS[0] && readGame(player, id).stage === 1) {
      if (session.promptOpen) return;
      session.promptOpen = true;
      // ZEP's own text input lives outside the game iframe and uses the mobile
      // keyboard. Never accept a stale prompt after closing/leaving/restarting.
      player.showPrompt("고구려와 신라 사이에 정치적 관계와 [ ㄱ ㄹ ]가 있었음을 보여 준다.\n정답 두 글자를 입력해 주세요.", function (text) {
        session.promptOpen = false;
        if (tag(player).museumGame !== session || !canPlay(player, index)) return;
        if (typeof text === "string") widget.sendMessage({ type: "museum:answer-draft", token: session.token, text: text.slice(0, 20) });
      });
      // Some ZEP clients omit the callback on Cancel. Permit a later retry.
      setTimeout(function () { session.promptOpen = false; }, 1000);
      return;
    }
    if (message.type !== "museum:action" || message.revision !== session.revision || !message.action) return;
    const next = applyGameAction(id, readGame(player, id), message.action);
    saveGame(player, id, next);
    session.revision++;
    if (next.done) {
      closeMuseumGame(player);
      handleMuseumMissionCompletion(player, id, open);
      refreshMuseumProgress(player);
    } else send();
  });
  send();
}

// Every NPC still uses the existing dialogue widget. This hook runs only after
// its last page, never on close. Server mission completion remains authoritative.
export function handleMuseumAction(player: ScriptPlayer, action: string, open: Open): void {
  if (ScriptApp.spaceHashID !== "nLP9zE") return;
  if (action.indexOf("gaya-clue:") === 0) {
    if (ScriptApp.mapHashID !== MUSEUM_MAPS.gaya) return;
    const clues = recordMuseumGayaClue(player, action.slice("gaya-clue:".length));
    player.showCenterLabel(`가야 철기 단서 ${clues.length}/3`);
    return;
  }
  if (action === "gaya-intro-complete") {
    const storage = loadPlayerStorage(player);
    savePlayerStorage(player, { ...storage, museumGayaIntroComplete: true }, { persist: true });
    return;
  }
  if (action === "hwangnam-crown:correct") {
    if (ScriptApp.mapHashID !== MUSEUM_MAPS.silla1) return;
    handleMuseumMissionCompletion(player, GAME_IDS[3], open);
    refreshMuseumProgress(player);
    return;
  }
  if (action.indexOf("baekje-brick:") === 0) {
    if (ScriptApp.mapHashID !== MUSEUM_MAPS.baekje) return;
    const brick = action.slice("baekje-brick:".length);
    if (!BAEKJE_BRICK_IDS.includes(brick)) return;
    const storage = loadPlayerStorage(player);
    const stored = Array.isArray(storage.museumBaekjeBricks) ? storage.museumBaekjeBricks : [];
    const bricks = Array.from(new Set([...stored.filter((value): value is string =>
      typeof value === "string" && BAEKJE_BRICK_IDS.includes(value)), brick]));
    savePlayerStorage(player, { ...storage, museumBaekjeBricks: bricks }, { persist: true });
    if (bricks.length === BAEKJE_BRICK_IDS.length) openMuseumGame(player, GAME_IDS[1], open);
    else player.showCenterLabel(`문전 확인 ${bricks.length}/${BAEKJE_BRICK_IDS.length}`);
    return;
  }
  if (action === "hou-intro-complete") {
    const storage = loadPlayerStorage(player);
    savePlayerStorage(player, { ...storage, museumHouIntroComplete: true }, { persist: true });
    (preparePlayerTag(player) as Record<string, unknown>).museumHouIntroComplete = true;
    const runtimeRoot = globalThis as typeof globalThis & {
      __nationalMuseumRuntime?: {
        museumHouClues?: Record<string, string[]>;
        museumHouIntroComplete?: Record<string, boolean>;
      };
    };
    runtimeRoot.__nationalMuseumRuntime ??= {};
    runtimeRoot.__nationalMuseumRuntime.museumHouIntroComplete ??= {};
    runtimeRoot.__nationalMuseumRuntime.museumHouIntroComplete[String(player.id)] = true;
    return;
  }
  if (action.indexOf("quiz-complete:") === 0) {
    const id = action.slice(14), index = GAME_IDS.indexOf(id);
    const playerTag = preparePlayerTag(player);
    if ((index !== 2 && index !== 3) || !canPlay(player, index) || playerTag.museumAnsweredQuiz !== id) return;
    playerTag.museumAnsweredQuiz = undefined;
    handleMuseumMissionCompletion(player, id, open);
    refreshMuseumProgress(player);
    return;
  }
  if (action.indexOf("game:") === 0) { openMuseumGame(player, action.slice(5), open); return; }
  // Narration must not chain into NPC dialogue or move the player automatically.
  if (action === "prologue") return;
  if (action === "ending") { saveMuseumStory(player, "ending"); refreshMuseumProgress(player); return; }
  if (action === "emergency") { saveMuseumStory(player, "emergency"); openMuseumGame(player, GAME_IDS[6], open); return; }
  runMuseumSceneTransition(player, action, open);
}

export function continueMuseum(player: ScriptPlayer, open: Open): void {
  if (ScriptApp.spaceHashID !== "nLP9zE") return;
  const map = ScriptApp.mapHashID;
  const state = journey(player);
  const next = MISSIONS.findIndex(m => !state.completed.includes(m.id));
  const directions: Record<string, string> = {
    [MUSEUM_MAPS.night]: "박물관 입구의 이동 지점으로 걸어가 사유의 방에 들어가세요.",
    [MUSEUM_MAPS.pensive]: "반가사유상 가까이 가서 F를 눌러 대화하세요.",
    [MUSEUM_MAPS.lobby1]: "광개토대왕릉비 옆 안내 로봇을 찾아가세요.",
    [MUSEUM_MAPS.lobby2]: "백제실 입구로 걸어가세요.",
    [MUSEUM_MAPS.lobby3]: "가야실 입구로 걸어가세요.",
    [MUSEUM_MAPS.lobby4]: "로비 오른쪽 신라실 문으로 걸어가세요.",
    [MUSEUM_MAPS.lobby5]: "유물 회의장 왼쪽 안내 로봇 가까이 가서 대화하세요.",
  };
  player.showCenterLabel(directions[map] || (next < 0 ? "모든 임무를 마쳤습니다. 박물관을 자유롭게 둘러보세요." : "전시실을 둘러보고 해당 유물 NPC 가까이에서 대화하세요. 닫은 미션도 NPC에게 다시 말을 걸면 이어집니다."));
}

export function interactMuseumNearby(player: ScriptPlayer, open: Open): boolean {
  const npc = nearbyMuseumNpc(player);
  if (!npc) return false;
  open(player, `npc:${npc}:intro`);
  return true;
}

export function startMuseumExperience(player: ScriptPlayer, open: Open): void {
  if (ScriptApp.spaceHashID !== "nLP9zE") return;
  preparePlayerStorage(player, { museumGames: {} });
  const t = tag(player);
  t.museumHud?.destroy();
  t.museumHud = undefined;
  handleMuseumArrival(player, open);
}
export function resetMuseumExperience(player: ScriptPlayer, open: Open): void {
  if (ScriptApp.spaceHashID !== "nLP9zE") return;
  leaveMuseumExperience(player);
  const playerTag = preparePlayerTag(player);
  const dialogue = playerTag.missionNpcWidget as ScriptWidget | undefined;
  dialogue?.destroy();
  if (playerTag.missionNpcPreDialogueCameraKey) player.setCameraTarget("");
  // Invalidate old widget/retry callbacks without granting their completion.
  Object.keys(playerTag).filter(key => key.indexOf("missionNpc") === 0).forEach(key => { delete playerTag[key]; });
  const storage = loadPlayerStorage(player);
  const npc = storage.missionNpc as { seenSceneKeys?: string[] } | undefined;
  savePlayerStorage(player, {
    ...storage,
    museumJourney: { completed: [] },
    museumGames: {},
    museumClues: [],
    museumHouIntroComplete: false,
    museumBaekjeBricks: [],
    museumGayaIntroComplete: false,
    museumGayaClues: [],
    ...(npc ? { missionNpc: { ...npc, seenSceneKeys: (npc.seenSceneKeys || []).filter(key => key.indexOf("museum-") !== 0) } } : {}),
  }, { persist: true });
  (preparePlayerTag(player) as Record<string, unknown>).museumHouClues = [];
  (preparePlayerTag(player) as Record<string, unknown>).museumHouIntroComplete = false;
  const runtimeRoot = globalThis as typeof globalThis & {
    __nationalMuseumRuntime?: {
      museumHouClues?: Record<string, string[]>;
      museumHouIntroComplete?: Record<string, boolean>;
    };
  };
  if (runtimeRoot.__nationalMuseumRuntime?.museumHouClues) {
    delete runtimeRoot.__nationalMuseumRuntime.museumHouClues[String(player.id)];
  }
  if (runtimeRoot.__nationalMuseumRuntime?.museumHouIntroComplete) {
    delete runtimeRoot.__nationalMuseumRuntime.museumHouIntroComplete[String(player.id)];
  }
  player.showCenterLabel("박물관 미션이 초기화되었습니다. 현재 위치에서 다시 시작하세요.");
}
export function leaveMuseumExperience(player: ScriptPlayer): void {
  preparePlayerTag(player).museumAnsweredQuiz = undefined;
  const t = tag(player);
  t.museumArrival = false;
  closeMuseumGame(player);
  closeMuseumProgress(player);
  t.museumHud?.destroy();
  t.museumHud = undefined;
}

// Validate the answer on the server; only the subsequent dialogue completion
// may grant progress. Closing or moving maps never completes the mission.
export function handleMuseumDialogueChoice(player: ScriptPlayer, id: string, index: number): void {
  const missionIndex = GAME_IDS.indexOf(id);
  const playerTag = preparePlayerTag(player);
  playerTag.museumAnsweredQuiz = undefined;
  if ((missionIndex !== 2 && missionIndex !== 3) || !canPlay(player, missionIndex) || journey(player).completed.includes(id)) return;
  const result = applyGameAction(id, createGameState(), { kind: "pick", index });
  if (result.done) playerTag.museumAnsweredQuiz = id;
}
