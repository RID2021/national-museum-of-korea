import { ColorType, ScriptPlayer } from "zep-script";

export function setFinalTitle(player: ScriptPlayer, mapName) {
  if (mapName === "근정전마지막") {
    player.title = "조선 전기 경복궁 생활사 전문가";
    player.titleColor = ColorType.WHITE;
    player.sendUpdated();
  }
  return;
}
