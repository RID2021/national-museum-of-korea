import type { ScriptPlayer, ScriptWidget } from "zep-script";
import { loadPlayerStorage, preparePlayerStorage, preparePlayerTag, savePlayerStorage } from "../utils/player";
import { GAME_IDS, GAME_TITLES, createGameState, applyGameAction, gameView, GameState, GameAction } from "./games";
import { MUSEUM_MAPS, MISSIONS, journey, saveMuseumStory, handleMuseumArrival, handleMuseumMissionCompletion, runMuseumSceneTransition } from "./navigation";

type Open = (player: ScriptPlayer, trigger: string) => unknown;
type Session = { widget: ScriptWidget; id: string; token: string; revision: number };
type MuseumTag = { museumGame?: Session; museumHud?: ScriptWidget; museumArrival?: boolean; missionNpcWidget?: ScriptWidget };
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
function canPlay(player: ScriptPlayer, index: number): boolean {
  return ScriptApp.spaceHashID === "nLP9zE" && ScriptApp.mapHashID === MISSIONS[index].map && MISSIONS.slice(0, index).every(m => journey(player).completed.includes(m.id));
}
export function openMuseumGame(player: ScriptPlayer, id: string, open: Open): void {
  const index = GAME_IDS.indexOf(id);
  if (index < 0 || !canPlay(player, index)) { player.showCenterLabel("현재 임무 버튼으로 진행 중인 전시실을 찾아주세요."); return; }
  const progress = journey(player);
  if (progress.completed.includes(id)) { continueMuseum(player, open); return; }
  if (id === GAME_IDS[6] && progress.story !== "emergency") { open(player, "npc:museum-guide-robot:meeting"); return; }
  closeMuseumGame(player);
  const widget = player.showWidget("html/museum-game-v1.html", "middle", player.isMobile ? 340 : 740, player.isMobile ? 520 : 590);
  const session: Session = { widget, id, token: String(Date.now()) + "-" + String(Math.random()), revision: 0 };
  tag(player).museumGame = session;
  saveGame(player, id, readGame(player, id));
  const send = (): void => widget.sendMessage({ type: "museum:game", token: session.token, revision: session.revision, ...gameView(id, readGame(player, id)) });
  widget.onMessage.Add(function (_sender, raw) {
    if (tag(player).museumGame !== session || !canPlay(player, index)) return;
    const message = raw as { type?: string; token?: string; revision?: number; action?: GameAction };
    if (message?.type === "museum:ready") { send(); return; }
    if (message?.token !== session.token) return;
    if (message.type === "museum:close") { closeMuseumGame(player); return; }
    if (message.type !== "museum:action" || message.revision !== session.revision || !message.action) return;
    const next = applyGameAction(id, readGame(player, id), message.action);
    saveGame(player, id, next);
    session.revision++;
    if (next.done) {
      closeMuseumGame(player);
      handleMuseumMissionCompletion(player, id, open);
      refreshMuseumHud(player);
    } else send();
  });
  send();
}

// Every NPC still uses the existing dialogue widget. This hook runs only after
// its last page, never on close. Server mission completion remains authoritative.
export function handleMuseumAction(player: ScriptPlayer, action: string, open: Open): void {
  if (ScriptApp.spaceHashID !== "nLP9zE") return;
  if (action.indexOf("game:") === 0) { openMuseumGame(player, action.slice(5), open); return; }
  if (action === "ending") { saveMuseumStory(player, "ending"); refreshMuseumHud(player); return; }
  if (action === "emergency") { saveMuseumStory(player, "emergency"); openMuseumGame(player, GAME_IDS[6], open); return; }
  runMuseumSceneTransition(player, action, open);
}

export function continueMuseum(player: ScriptPlayer, open: Open): void {
  if (ScriptApp.spaceHashID !== "nLP9zE") return;
  const t = tag(player);
  if (t.missionNpcWidget || t.museumGame) return;
  const map = ScriptApp.mapHashID;
  const state = journey(player);
  const pending = MISSIONS.find(m => m.id === state.pendingCompletion);
  if (pending) {
    if (map !== pending.map) player.spawnAtMap(ScriptApp.spaceHashID, pending.map);
    else open(player, `npc:${pending.npc}:${pending.id === GAME_IDS[5] ? "etiquette-success" : "success"}`);
    return;
  }
  const next = MISSIONS.findIndex(m => !state.completed.includes(m.id));
  if (next < 0) {
    if (map !== MUSEUM_MAPS.day) player.spawnAtMap(ScriptApp.spaceHashID, MUSEUM_MAPS.day);
    else open(player, "npc:museum-guide-robot:ending");
    return;
  }
  if (next === 0 && map === MUSEUM_MAPS.night) { open(player, "npc:museum-pensive-1:prologue"); return; }
  if (next === 0 && map === MUSEUM_MAPS.pensive) { open(player, "npc:museum-pensive-1:intro"); return; }
  if (next === 0 && map === MUSEUM_MAPS.lobby1) { open(player, "npc:museum-guide-robot:intro"); return; }
  const mission = MISSIONS[next];
  if (map !== mission.map) { player.spawnAtMap(ScriptApp.spaceHashID, mission.map); return; }
  if (next === 6) {
    if (state.story === "emergency") openMuseumGame(player, mission.id, open);
    else open(player, "npc:museum-guide-robot:meeting");
  } else if (readGame(player, mission.id).moves > 0 || (loadPlayerStorage(player).museumGames as Record<string, GameState> | undefined)?.[mission.id]) {
    openMuseumGame(player, mission.id, open);
  } else open(player, `npc:${mission.npc}:${next === 5 ? "etiquette-intro" : "intro"}`);
}

function refreshMuseumHud(player: ScriptPlayer): void {
  const state = journey(player);
  const index = MISSIONS.findIndex(m => !state.completed.includes(m.id));
  tag(player).museumHud?.sendMessage({ type: "museum:hud", title: index < 0 ? "정식 박물관 지키미" : GAME_TITLES[index], count: state.completed.length, complete: state.endingSeen });
}
export function startMuseumExperience(player: ScriptPlayer, open: Open): void {
  if (ScriptApp.spaceHashID !== "nLP9zE") return;
  preparePlayerStorage(player, { museumGames: {} });
  const t = tag(player);
  t.museumHud?.destroy();
  const hud = player.showWidget("html/museum-hud-v1.html", "topright", player.isMobile ? 180 : 250, 100);
  t.museumHud = hud;
  hud.onMessage.Add(function (_sender, raw) {
    if (tag(player).museumHud !== hud) return;
    const type = (raw as { type?: string })?.type;
    if (type === "museum:ready") refreshMuseumHud(player);
    if (type === "museum:continue") continueMuseum(player, open);
    if (type === "museum:restart-confirmed") {
      // Only this player's museum progress changes; preserve other storage.
      if (tag(player).missionNpcWidget) return;
      closeMuseumGame(player);
      const data = loadPlayerStorage(player);
      savePlayerStorage(player, { ...data, museumJourney: { completed: [] }, museumGames: {} }, { persist: true });
      player.spawnAtMap(ScriptApp.spaceHashID, MUSEUM_MAPS.night);
    }
  });
  refreshMuseumHud(player);
  handleMuseumArrival(player, open);
  t.museumArrival = true;
  const source = ScriptApp.mapHashID;
  setTimeout(function () {
    if (!t.museumArrival || ScriptApp.mapHashID !== source || t.missionNpcWidget || t.museumGame) return;
    // Automatically greet the visitor in each actual exhibition room. Lobbies
    // retain their exploration space and offer a reliable next-room button.
    if (MISSIONS.some(m => m.map === source) || source === MUSEUM_MAPS.pensive || source === MUSEUM_MAPS.lobby1) continueMuseum(player, open);
  }, 1600);
}
export function leaveMuseumExperience(player: ScriptPlayer): void {
  const t = tag(player);
  t.museumArrival = false;
  closeMuseumGame(player);
  t.museumHud?.destroy();
  t.museumHud = undefined;
}
