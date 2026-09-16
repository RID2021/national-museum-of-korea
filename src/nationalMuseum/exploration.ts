import type { ScriptPlayer } from "zep-script";
import { loadPlayerStorage, savePlayerStorage } from "../utils/player";
import { GAME_IDS } from "./games";
import { journey, MISSIONS, MUSEUM_MAPS } from "./navigation";

// Verified editor/world coordinates. Interaction requires walking to the NPC.
export const MUSEUM_NPC_SPOTS = [
  { map: MUSEUM_MAPS.pensive, x: 19, y: 14, npc: "museum-pensive-1" },
  { map: MUSEUM_MAPS.pensive, x: 45, y: 14, npc: "museum-pensive-2" },
  { map: MUSEUM_MAPS.lobby1, x: 42, y: 14, npc: "museum-guide-robot" },
  { map: MUSEUM_MAPS.goguryeo, x: 31, y: 29, npc: "museum-hou-bronze-bowl" },
  { map: MUSEUM_MAPS.baekje, x: 36, y: 30, npc: "museum-baekje-landscape-brick" },
  { map: MUSEUM_MAPS.gaya, x: 36, y: 25, npc: "museum-gaya-armor-helmet" },
  { map: MUSEUM_MAPS.silla1, x: 35, y: 25, npc: "museum-hwangnam-gold-crown" },
  { map: MUSEUM_MAPS.silla2, x: 39, y: 27, npc: "museum-jinheung-stele" },
  { map: MUSEUM_MAPS.lobby5, x: 38, y: 49, npc: "museum-guide-robot" },
];
export function nearbyMuseumNpc(player: ScriptPlayer): string | undefined {
  if (ScriptApp.spaceHashID !== "nLP9zE") return;
  return MUSEUM_NPC_SPOTS.find(spot => spot.map === ScriptApp.mapHashID &&
    Math.abs(player.tileX - spot.x) <= 2 && Math.abs(player.tileY - spot.y) <= 2)?.npc;
}

const HOU_CLUE_IDS = ["gwang", "gae", "to"] as const;
type MuseumRuntimeState = {
  museumHouClues?: Record<string, string[]>;
  museumHouIntroComplete?: Record<string, boolean>;
};

function runtimeHouClues(): Record<string, string[]> {
  const root = globalThis as typeof globalThis & { __nationalMuseumRuntime?: MuseumRuntimeState };
  root.__nationalMuseumRuntime ??= {};
  root.__nationalMuseumRuntime.museumHouClues ??= {};
  return root.__nationalMuseumRuntime.museumHouClues;
}

/** Read and normalize the three persistent 호우총 단서 flags. */
export function getMuseumHouClues(player: ScriptPlayer): string[] {
  const stored = loadPlayerStorage(player).museumClues;
  const tagged = (player.tag as Record<string, unknown> | undefined)?.museumHouClues;
  const runtime = runtimeHouClues()[String(player.id)];
  const values = [
    ...(Array.isArray(stored) ? stored : []),
    ...(Array.isArray(tagged) ? tagged : []),
    ...(runtime ?? []),
  ];
  return Array.from(new Set(values.filter((value): value is string =>
    typeof value === "string" && HOU_CLUE_IDS.includes(value as (typeof HOU_CLUE_IDS)[number]))));
}

export function hasAllMuseumHouClues(player: ScriptPlayer): boolean {
  const clues = getMuseumHouClues(player);
  return HOU_CLUE_IDS.every(clue => clues.includes(clue));
}

export function hasCompletedMuseumHouIntro(player: ScriptPlayer): boolean {
  const storage = loadPlayerStorage(player);
  const tagged = (player.tag as Record<string, unknown> | undefined)?.museumHouIntroComplete;
  const root = globalThis as typeof globalThis & { __nationalMuseumRuntime?: MuseumRuntimeState };
  return storage.museumHouIntroComplete === true || tagged === true ||
    root.__nationalMuseumRuntime?.museumHouIntroComplete?.[String(player.id)] === true;
}

export function recordMuseumHouClue(player: ScriptPlayer, clue: string): string[] {
  const clues = getMuseumHouClues(player);
  if (!HOU_CLUE_IDS.includes(clue as (typeof HOU_CLUE_IDS)[number])) return clues;
  const next = Array.from(new Set([...clues, clue]));
  runtimeHouClues()[String(player.id)] = next;
  if (next.length !== clues.length) {
    const storage = loadPlayerStorage(player);
    savePlayerStorage(player, { ...storage, museumClues: next }, { persist: true });
  }
  return next;
}

export function resolveMuseumSceneId(player: ScriptPlayer, npc: string, requested: string): string {
  if (ScriptApp.spaceHashID !== "nLP9zE" || requested !== "intro") return requested;
  const state = journey(player);
  const pending = MISSIONS.find(m => m.id === state.pendingCompletion && m.npc === npc && m.map === ScriptApp.mapHashID);
  if (pending) return pending.id === GAME_IDS[5] ? "etiquette-success" : "success";
  if (npc === "museum-hou-bronze-bowl") {
    if (!hasCompletedMuseumHouIntro(player)) return "intro";
    const clues = getMuseumHouClues(player);
    if (clues.length < HOU_CLUE_IDS.length) return "clues-incomplete";
    if (hasAllMuseumHouClues(player)) return "quiz";
  }
  if (npc === "museum-guide-robot" && ScriptApp.mapHashID === MUSEUM_MAPS.lobby2) return "baekje-guide";
  if (npc === "museum-guide-robot" && ScriptApp.mapHashID === MUSEUM_MAPS.lobby3) return "gaya-guide";
  if (npc === "museum-guide-robot" && ScriptApp.mapHashID === MUSEUM_MAPS.lobby4) return "silla-guide";
  if (npc === "museum-guide-robot" && ScriptApp.mapHashID === MUSEUM_MAPS.lobby5) {
    if (!state.completed.includes(GAME_IDS[5])) return "etiquette-intro";
    return state.story === "emergency" ? "emergency" : "meeting";
  }
  return requested;
}
export function registerMuseumExploration(): void {
  if (ScriptApp.spaceHashID !== "nLP9zE") return;
  // Existing Silla doorway, read from the live editor (98,45). No HUD teleport.
  if (ScriptApp.mapHashID === MUSEUM_MAPS.lobby4) {
    ScriptApp.addOnTileTouched(98, 45, function (player) {
      player.spawnAtMap(ScriptApp.spaceHashID, MUSEUM_MAPS.silla1);
    });
  }
}
