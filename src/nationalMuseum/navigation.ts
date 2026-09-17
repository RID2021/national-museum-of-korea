import type { ScriptPlayer } from "zep-script";
import { loadPlayerStorage, savePlayerStorage } from "../utils/player";

// Verified against the live editor's map URLs and portal destinations, 2026-09-14.
export const MUSEUM_MAPS = {
  night: "R57laZ", pensive: "WarEng", lobby1: "LB6MNd", goguryeo: "0EAV9k",
  lobby2: "pnNepx", baekje: "kP0x5B", lobby3: "xEOeqz", gaya: "7RE0Ea",
  lobby4: "eXY3Yx", silla1: "r7aeam", silla2: "dJzqzn", lobby5: "pnNeN3", day: "XWA4Aj",
};
const SPACE = "nLP9zE";
type OpenDialogue = (player: ScriptPlayer, trigger: string) => unknown;
type Journey = { completed: string[]; pendingEnding?: boolean; pendingCompletion?: string; story?: string; prologueSeen?: boolean; pensiveBroadcastSeen?: boolean; pensiveLightsOut?: boolean; baekjeIntroSeen?: boolean; sillaCrownIntroSeen?: boolean; endingSeen?: boolean; travel?: string[] };
export const MISSIONS = [
  { id: "museum-hou-relations", map: MUSEUM_MAPS.goguryeo, destination: MUSEUM_MAPS.lobby2, npc: "museum-hou-bronze-bowl" },
  { id: "museum-baekje-bricks", map: MUSEUM_MAPS.baekje, destination: MUSEUM_MAPS.lobby3, npc: "museum-baekje-landscape-brick" },
  { id: "museum-gaya-iron", map: MUSEUM_MAPS.gaya, destination: MUSEUM_MAPS.lobby4, npc: "museum-gaya-armor-helmet" },
  { id: "museum-hwangnam-crown", map: MUSEUM_MAPS.silla1, destination: MUSEUM_MAPS.silla2, npc: "museum-hwangnam-gold-crown" },
  // Emit this only AFTER the puzzle AND every stele-location confirmation.
  { id: "museum-jinheung-locations", map: MUSEUM_MAPS.silla2, destination: MUSEUM_MAPS.lobby5, npc: "museum-jinheung-stele" },
  { id: "museum-etiquette", map: MUSEUM_MAPS.lobby5, destination: "", npc: "museum-guide-robot" },
  { id: "museum-artifact-cards", map: MUSEUM_MAPS.lobby5, destination: MUSEUM_MAPS.day, npc: "museum-guide-robot" },
];

export function journey(player: ScriptPlayer): Journey {
  const value = loadPlayerStorage(player).museumJourney as Journey | undefined;
  return { completed: Array.isArray(value?.completed) ? value.completed : [], pendingEnding: value?.pendingEnding === true,
    pendingCompletion: typeof value?.pendingCompletion === "string" ? value.pendingCompletion : undefined,
    story: value?.story, prologueSeen: value?.prologueSeen === true,
    pensiveBroadcastSeen: value?.pensiveBroadcastSeen === true,
    // Migrate players who completed the broadcast before this field existed.
    // Newly started broadcasts persist an explicit false until page 3/3 ends.
    pensiveLightsOut: value?.pensiveLightsOut === true ||
      (value?.pensiveLightsOut === undefined && value?.pensiveBroadcastSeen === true),
    baekjeIntroSeen: value?.baekjeIntroSeen === true,
    sillaCrownIntroSeen: value?.sillaCrownIntroSeen === true,
    endingSeen: value?.endingSeen === true, travel: Array.isArray(value?.travel) ? value.travel : [] };
}

function persist(player: ScriptPlayer, value: Journey): void {
  savePlayerStorage(player, { ...loadPlayerStorage(player), museumJourney: value }, { persist: true });
}

export function completePensiveBroadcast(player: ScriptPlayer): void {
  const state = journey(player);
  state.pensiveBroadcastSeen = true;
  state.pensiveLightsOut = true;
  persist(player, state);
}

export function saveMuseumStory(player: ScriptPlayer, story: string): void {
  const state = journey(player);
  state.story = story;
  if (story === "ending") { state.endingSeen = true; state.pendingEnding = false; }
  persist(player, state);
}

// Server-side completion callback only. Not registered as a chat/object/widget
// "success" command: viewing a success dialogue cannot complete a mission.
export function handleMuseumMissionCompletion(player: ScriptPlayer, gameId: string, open: OpenDialogue): boolean {
  if (ScriptApp.spaceHashID !== SPACE) return false;
  const index = MISSIONS.findIndex(mission => mission.id === gameId);
  if (index < 0) return false;
  const mission = MISSIONS[index];
  const state = journey(player);
  // Direct map links are part of the visitor flow and are also used for
  // on-site testing. Completing the correct room must therefore be valid even
  // when an earlier room has not yet been recorded in this browser session.
  if (ScriptApp.mapHashID !== mission.map) return true;
  if (state.completed.includes(gameId)) return true;
  state.completed.push(gameId);
  if (gameId === "museum-artifact-cards") {
    state.pendingEnding = true;
    persist(player, state);
    player.spawnAtMap(ScriptApp.spaceHashID, MUSEUM_MAPS.day);
    return true;
  }
  state.pendingCompletion = gameId;
  persist(player, state);
  if (gameId === "museum-etiquette") player.spawnAt(52, 40);
  open(player, `npc:${mission.npc}:${gameId === "museum-etiquette" ? "etiquette-success" : "success"}`);
  return true;
}

export function runMuseumSceneTransition(player: ScriptPlayer, transition: string, open: OpenDialogue): void {
  if (ScriptApp.spaceHashID !== SPACE) return;
  const direct: Record<string, [string, string]> = {
    introduction: [MUSEUM_MAPS.pensive, MUSEUM_MAPS.lobby1],
  };
  const route = direct[transition];
  if (route) {
    if (ScriptApp.mapHashID === route[0]) {
      const state = journey(player);
      if (!state.travel?.includes(route[1])) state.travel = [...(state.travel || []), route[1]];
      persist(player, state);
      if (transition === "introduction") {
        try {
          player.setCameraEffectParam(0, 0);
          player.sendUpdated();
        } catch (_error) {
          // Older clients may not expose the per-player camera effect API.
        }
      }
      player.spawnAtMap(ScriptApp.spaceHashID, route[1]);
    }
    return;
  }
  const mission = MISSIONS.find(item => item.id === transition);
  const state = journey(player);
  if (!mission || ScriptApp.mapHashID !== mission.map || state.pendingCompletion !== transition || !state.completed.includes(transition)) return;
  state.pendingCompletion = undefined;
  persist(player, state);
  if (transition === "museum-etiquette") open(player, "npc:museum-guide-robot:meeting");
  else if (mission.destination) player.spawnAtMap(ScriptApp.spaceHashID, mission.destination);
}

export function handleMuseumArrival(player: ScriptPlayer, open: OpenDialogue): void {
  if (ScriptApp.spaceHashID !== SPACE) return;
  const map = ScriptApp.mapHashID;
  const state = journey(player);
  let trigger = "";
  // Only the first entry narration and earned ending are automatic. Finishing
  // the narration leaves the player in the world; NPCs still require interaction.
  if (map === MUSEUM_MAPS.pensive && !state.pensiveBroadcastSeen) {
    setTimeout(function () {
      if (ScriptApp.spaceHashID !== SPACE || ScriptApp.mapHashID !== map) return;
      const current = journey(player);
      if (current.pensiveBroadcastSeen) return;
      current.pensiveBroadcastSeen = true;
      persist(player, current);
      open(player, "npc:museum-pensive-1:prologue");
    }, 300);
    return;
  }
  if (map === MUSEUM_MAPS.baekje && !state.baekjeIntroSeen && !state.completed.includes("museum-baekje-bricks")) {
    setTimeout(function () {
      if (ScriptApp.spaceHashID !== SPACE || ScriptApp.mapHashID !== map) return;
      const current = journey(player);
      if (current.baekjeIntroSeen || current.completed.includes("museum-baekje-bricks")) return;
      current.baekjeIntroSeen = true;
      persist(player, current);
      open(player, "npc:museum-baekje-landscape-brick:intro");
    }, 700);
    return;
  }
  if (map === MUSEUM_MAPS.silla1 && !state.sillaCrownIntroSeen && !state.completed.includes("museum-hwangnam-crown")) {
    setTimeout(function () {
      if (ScriptApp.spaceHashID !== SPACE || ScriptApp.mapHashID !== map) return;
      const current = journey(player);
      if (current.sillaCrownIntroSeen || current.completed.includes("museum-hwangnam-crown")) return;
      current.sillaCrownIntroSeen = true;
      persist(player, current);
      open(player, "npc:museum-hwangnam-gold-crown:intro");
    }, 700);
    return;
  }
  if (map === MUSEUM_MAPS.day && state.pendingEnding) {
    trigger = "npc:museum-guide-robot:ending";
  }
  if (trigger) setTimeout(function () { if (ScriptApp.mapHashID === map) open(player, trigger); }, 700);
}
