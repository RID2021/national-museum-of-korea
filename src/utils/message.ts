import type { ScriptPlayer } from "zep-script";

import { isObject } from "util";
import { DEBUG_FLAG } from "./debugFlag";

function toText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (_error) {
      return String(value);
    }
  }

  return String(value);
}

export function debugMessage(message: unknown, recipients?: ScriptPlayer | ScriptPlayer[]): void {
  if (!DEBUG_FLAG) {
    return;
  }

  const text = toText(message);

  if (!text) {
    return;
  }

  const targets: ScriptPlayer[] = Array.isArray(recipients)
    ? recipients
    : recipients
      ? [recipients]
      : ScriptApp.players || [];

  targets.forEach(function (player) {
    if (typeof player.role !== "number" || player.role <= 1000) {
      return;
    }

    if(isObject(message)){
      player.sendMessage(JSON.stringify(message));
    }
    else{
      player.sendMessage(message as string)
    }
    
  });
}
