import { ScriptPlayer } from "zep-script";
export function moveCamera(
  player: ScriptPlayer,
  targetX: number,
  targetY: number,
  currentX: number,
  currentY: number,
  move_time1: number = 1.5,
  move_time2: number = 1
) {
  player.moveSpeed = 0;
  player.setCameraTarget(targetX, targetY, move_time1);
  player.sendUpdated();
  setTimeout(() => {
    player.setCameraTarget(currentX, currentY, move_time2);
    player.sendUpdated();

    setTimeout(() => {
      player.setCameraTarget("");
      player.moveSpeed = 80;
      player.sendUpdated();
    }, (move_time2 + 1) * 1000);
  }, (move_time1 + 1) * 1000);
}

export function cameraMoveByMapName(player: ScriptPlayer, mapName: string) {
  switch (mapName) {
    case "피마길":
      moveCamera(player, 33, 37, 33, 59);
      break;
    case "근정전1번":
      moveCamera(player, 33, 44, 4, 60);
      break;
    case "근정전2번":
      moveCamera(player, 46, 34, 16, 54);
      break;
    case "근정전내부1번":
      moveCamera(player, 22, 32, 33, 59);
      break;
    case "근정전내부2번":
      moveCamera(player, 33, 37, 33, 59);
      break;
    case "사정전낮":
      moveCamera(player, 23, 33, 33, 57);
      break;
    case "사정전밤":
      moveCamera(player, 33, 30, 32, 60);
      break;
    case "집현전내부":
      moveCamera(player, 26, 29, 13, 46);
      break;
    case "집현전외부":
      moveCamera(player, 50, 39, 49, 50);
      break;
    case "경회루일반":
      moveCamera(player, 74, 25, 30, 30);
      break;
    case "경회루기녀":
      moveCamera(player, 27, 33, 70, 22);
      break;
    case "강녕전외부":
      moveCamera(player, 92, 28, 48, 43);
      break;
    case "강녕전외부2":
      moveCamera(player, 83, 34, 47, 43);
      break;
    case "바람":
      moveCamera(player, 23, 9, 23, 124);
      break;
    case "강녕전내부":
      moveCamera(player, 25, 19, 32, 62);
      break;
    default:
      break;
  }
}
