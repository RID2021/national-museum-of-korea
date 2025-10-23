import { ColorType, ScriptPlayer } from "zep-script";

export function setFinalTitle(player: ScriptPlayer, mapName) {
  if (mapName === "근정전마지막") {
    player.title = "조선 전기 경복궁 생활사 전문가";
    player.titleColor = ColorType.WHITE;
    player.sendUpdated();
  }
  if (mapName === "종로길거리_마지막_경시서_관리") {
    player.title = "진정한 조선인";
    player.titleColor = ColorType.WHITE;
    player.sendUpdated();
  }
  return;
}
