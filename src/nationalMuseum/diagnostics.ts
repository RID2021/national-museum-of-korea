import type { ScriptPlayer } from "zep-script";
import { debugMessage } from "../utils/message";
import { preparePlayerTag } from "../utils/player";

const errors: string[] = [];
const MUSEUM_SPACE = "nLP9zE";

// Keep the original exception behavior; retain its context for an admin audit.
export function runMuseumDiagnosticPhase(name: string, action: () => void): void {
  try {
    action();
  } catch (error) {
    if (ScriptApp.spaceHashID === MUSEUM_SPACE) {
      errors.push(`${name}: ${String(error)} ${(error as Error)?.stack ?? ""}`);
      if (errors.length > 8) errors.shift();
    }
    throw error;
  }
}

export function traceMuseumObject(
  player: ScriptPlayer, layer: number, x: number, y: number, key: unknown
): void {
  if (ScriptApp.spaceHashID !== MUSEUM_SPACE || player.role <= 1000) return;
  if (!preparePlayerTag(player).museumAuditEnabled) return;
  debugMessage(`[MUSEUM F] ${JSON.stringify({ layer, x, y, key })}`, player);
}

export function handleMuseumDiagnosticCommand(player: ScriptPlayer, text: string): boolean {
  if (ScriptApp.spaceHashID !== MUSEUM_SPACE || player.role <= 1000) return false;
  if (text === "#museum-audit-off") {
    preparePlayerTag(player).museumAuditEnabled = false;
    return true;
  }
  const position = /^#museum-at (\d+) (\d+)$/.exec(text);
  if (position && preparePlayerTag(player).museumAuditEnabled) {
    const x = Number(position[1]);
    const y = Number(position[2]);
    if (x < ScriptMap.width && y < ScriptMap.height && ScriptMap.getTile(2, x, y) !== 1) {
      // Move only the requesting administrator. Never change a map or storage.
      player.spawnAt(x, y);
    } else {
      debugMessage("[MUSEUM] Outside map or impassable tile; position unchanged.", player);
    }
    return true;
  }
  if (text !== "#museum-check") return false;
  preparePlayerTag(player).museumAuditEnabled = true;
  debugMessage(`[MUSEUM] ${ScriptMap.name} ${ScriptApp.mapHashID} position=${player.tileX},${player.tileY} speed=${player.moveSpeed}`, player);
  debugMessage(`[MUSEUM errors] ${JSON.stringify(errors)}`, player);
  [3, 5].forEach(function (layer) {
    const objects = layer === 3 ? ScriptMap.getObjectsByType(21) : ScriptMap.getTopObjectsByType(21);
    objects.forEach(function (object) {
      const position = object as unknown as { tileX: number; tileY: number };
      debugMessage(`[MUSEUM object] ${JSON.stringify({ layer, x: position.tileX, y: position.tileY,
        range: object.activeDistance, value: object.param1, name: object.tooltip })}`, player);
    });
  });
  return true;
}
