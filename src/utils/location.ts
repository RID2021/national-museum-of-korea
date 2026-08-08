import type { ScriptPlayer } from "zep-script";

interface LocationPoint {
  x: number;
  y: number;
}

function getTileCoordinate(value: number): number {
  return Math.floor(value);
}

function isNearPlayer(
  playerX: number,
  playerY: number,
  point: LocationPoint,
  radius: number
): boolean {
  return Math.abs(point.x - playerX) <= radius && Math.abs(point.y - playerY) <= radius;
}

export function findNearbyLocationName(
  player: ScriptPlayer,
  locationNames: Iterable<string>,
  radius = 1
): string | null {
  const playerX = getTileCoordinate(player.tileX);
  const playerY = getTileCoordinate(player.tileY);

  for (const locationName of locationNames) {
    if (!locationName || !ScriptMap.hasLocation(locationName)) {
      continue;
    }

    const locations = ScriptMap.getLocationList(locationName);
    if (!Array.isArray(locations)) {
      continue;
    }

    const isNearby = locations.some(function (point) {
      return isNearPlayer(playerX, playerY, point, radius);
    });

    if (isNearby) {
      return locationName;
    }
  }

  return null;
}
