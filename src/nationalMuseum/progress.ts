import type { ScriptPlayer, ScriptWidget } from "zep-script";
import { preparePlayerTag } from "../utils/player";
import { GAME_IDS } from "./games";
import { journey, MISSIONS, MUSEUM_MAPS } from "./navigation";

type ProgressTag = { museumProgressWidget?: ScriptWidget; missionNpcWidget?: ScriptWidget; museumGame?: unknown };
type Travel = { map?: string; label: string; reason: string };
const ROOM_NAMES: Record<string, string> = {
  [MUSEUM_MAPS.pensive]: "사유의 방", [MUSEUM_MAPS.lobby1]: "로비(1)",
  [MUSEUM_MAPS.goguryeo]: "고구려실", [MUSEUM_MAPS.baekje]: "백제실",
  [MUSEUM_MAPS.gaya]: "가야실", [MUSEUM_MAPS.silla1]: "신라실(1)",
  [MUSEUM_MAPS.silla2]: "신라실(2)", [MUSEUM_MAPS.lobby5]: "회의장 로비", [MUSEUM_MAPS.day]: "박물관 밖(낮)",
};

// Recomputed on every click. The HTML's unlocked appearance never grants access.
export function museumTravel(player: ScriptPlayer): Travel {
  const state = journey(player);
  if (state.pendingCompletion) return { label: "성공 대화 완료 후 이동 가능", reason: "해당 NPC의 성공 대화를 끝까지 읽어주세요." };
  const next = MISSIONS.findIndex(m => !state.completed.includes(m.id));
  let map: string | undefined;
  if (next === -1) map = MUSEUM_MAPS.day;
  else if (next > 0) map = MISSIONS[next].map;
  else {
    // Dialogue-only milestones, granted at the last page, not on arrival/open.
    map = [MUSEUM_MAPS.goguryeo, MUSEUM_MAPS.lobby1, MUSEUM_MAPS.pensive].find(id => state.travel?.includes(id));
  }
  if (!map) return { label: "안내 대화 완료 후 이동 가능", reason: "먼저 맵의 NPC를 찾아가 안내 대화를 끝까지 읽어주세요." };
  if (map === ScriptApp.mapHashID) return { label: next === -1 ? "모든 미션 완료" : "현재 전시실을 체험해 주세요", reason: next === -1 ? "모든 미션을 완료했습니다." : "이곳의 NPC를 찾아 미션을 진행해주세요. 완료 전에는 다음 맵으로 이동할 수 없습니다." };
  return { map, label: `${ROOM_NAMES[map]}로 이동하기`, reason: "" };
}

export function museumProgressPayload(player: ScriptPlayer): Record<string, unknown> {
  const state = journey(player);
  const completed = GAME_IDS.filter(id => state.completed.includes(id)).length;
  const route = museumTravel(player);
  return {
    missionId: "national-museum-overall", title: "전체 미션 진행률", completed, total: GAME_IDS.length,
    completedMission: completed === GAME_IDS.length, percent: Math.round(completed / GAME_IDS.length * 100),
    detail: `${completed}/${GAME_IDS.length}`, status: completed === GAME_IDS.length ? "미션 완료" : "진행 중",
    museumButtonLabel: route.label, nextStepLabel: route.label, museumLockedMessage: route.reason, museumUnlocked: Boolean(route.map),
  };
}
export function closeMuseumProgress(player: ScriptPlayer): void {
  const tag = preparePlayerTag(player) as ProgressTag;
  tag.museumProgressWidget?.destroy();
  tag.museumProgressWidget = undefined;
}
export function refreshMuseumProgress(player: ScriptPlayer): void {
  const tag = preparePlayerTag(player) as ProgressTag;
  tag.museumProgressWidget?.sendMessage({ type: "mission-progress:init", payload: museumProgressPayload(player) });
}
export function travelFromMuseumProgress(player: ScriptPlayer): boolean {
  if (ScriptApp.spaceHashID !== "nLP9zE") return false;
  const tag = preparePlayerTag(player) as ProgressTag;
  if (tag.missionNpcWidget || tag.museumGame) {
    player.showCenterLabel("진행 중인 대화나 미션을 먼저 마무리해 주세요.");
    return false;
  }
  const route = museumTravel(player);
  if (!route.map) { player.showCenterLabel(route.reason); refreshMuseumProgress(player); return false; }
  closeMuseumProgress(player);
  player.spawnAtMap(ScriptApp.spaceHashID, route.map);
  return true;
}
export function showMuseumProgress(player: ScriptPlayer): void {
  if (ScriptApp.spaceHashID !== "nLP9zE") return;
  const tag = preparePlayerTag(player) as ProgressTag;
  if (tag.museumProgressWidget) { refreshMuseumProgress(player); return; }
  // Exactly the seoul_2 tomb template and dimensions. Only museum data differs.
  const widget = player.showWidget("html/mission-progress-widget.html", "middle", player.isMobile ? 330 : 390, 450);
  tag.museumProgressWidget = widget;
  widget.onMessage.Add(function (_sender, raw) {
    if (tag.museumProgressWidget !== widget) return;
    const type = (raw as { type?: string })?.type;
    if (type === "mission-progress:close") closeMuseumProgress(player);
    if (type === "mission-progress:ready") refreshMuseumProgress(player);
    if (type === "mission-progress:open-museum") travelFromMuseumProgress(player);
  });
  refreshMuseumProgress(player);
}
