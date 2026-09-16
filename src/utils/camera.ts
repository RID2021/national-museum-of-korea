import { ScriptPlayer } from "zep-script";

export interface CameraWaypoint {
  x: number;
  y: number;
  duration?: number;
  time?: number;
}

export type CameraWaypointInput = CameraWaypoint | [number, number, number?];

export interface CameraMoveOptions {
  origin?: { x: number; y: number };
  returnToStart?: boolean;
  returnDuration?: number;
  defaultDuration?: number;
  waitBufferSeconds?: number;
  restoreMoveSpeed?: number;
}

interface NormalizedCameraWaypoint {
  x: number;
  y: number;
  duration?: number;
}

interface CameraRouteConfig {
  path: CameraWaypointInput[];
  options?: CameraMoveOptions;
}

interface CameraFocusConfig {
  x: number;
  y: number;
  durationMs: number;
  moveDuration?: number;
}

const DEFAULT_MOVE_DURATION = 1.5;
const DEFAULT_RETURN_DURATION = 1;
const DEFAULT_WAIT_BUFFER = 1;
const DEFAULT_MOVE_SPEED = 80;

const cameraFocusRoutes: Record<string, CameraFocusConfig> = {
  "로비(5)": {
    x: 52,
    y: 40,
    durationMs: 3000,
    moveDuration: 0.45,
  },
};

const cameraRoutes: Record<string, CameraRouteConfig> = {
  광화문1: {
    path: [
      [44, 56, 1],
      [39, 30, 1],
    ],
    options: {
      origin: { x: 39, y: 77 },
      returnToStart: true,
      returnDuration: 1,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  흥례문: {
    path: [
      [21, 43, 1],
      [49, 32, 1],
      [71, 16, 1],
    ],
    options: {
      origin: { x: 5, y: 56 },
      returnToStart: true,
      returnDuration: 1,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  근정전외부1: {
    path: [
      [11, 52, 1],
      [34, 43, 1],
      [49, 31, 1],
    ],
    options: {
      origin: { x: 10, y: 58 },
      returnToStart: true,
      returnDuration: 1,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  근정전내부: {
    path: [
      [30, 60, 1],
      [33, 36, 1],
    ],
    options: {
      origin: { x: 31, y: 54 },
      returnToStart: true,
      returnDuration: 1,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  근정전외부2: {
    path: [
      [10, 61, 1],
      [33, 20, 1],
    ],
    options: {
      origin: { x: 10, y: 58 },
      returnToStart: true,
      returnDuration: 1,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  향원지불x: {
    path: [
      [38, 60, 1],
      [38, 49, 1],
      [37, 28, 1],
    ],
    options: {
      origin: { x: 37, y: 64 },
      returnToStart: true,
      returnDuration: 1,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  영훈당: {
    path: [
      [48, 71, 1],
      [39, 39, 1],
    ],
    options: {
      origin: { x: 42, y: 75 },
      returnToStart: true,
      returnDuration: 1,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  향원정불o: {
    path: [
      [38, 55, 1],
      [36, 29, 1],
    ],
    options: {
      origin: { x: 36, y: 64 },
      returnToStart: true,
      returnDuration: 1,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  향원정: {
    path: [
      [40, 29, 1],
      [61, 22, 1],
    ],
    options: {
      origin: { x: 15, y: 50 },
      returnToStart: true,
      returnDuration: 1,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  건청궁외부: {
    path: [
      [57, 44, 1],
      [33, 73, 1],
    ],
    options: {
      origin: { x: 43, y: 49 },
      returnToStart: true,
      returnDuration: 1,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  강녕전외부1: {
    path: [[66, 33, 1]],
    options: {
      origin: { x: 39, y: 48 },
      returnToStart: true,
      returnDuration: 1,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  강녕전내부: {
    path: [
      [46, 44, 1],
      [71, 48, 1],
    ],
    options: {
      origin: { x: 38, y: 48 },
      returnToStart: true,
      returnDuration: 1,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  강녕전외부2: {
    path: [[40, 70, 1]],
    options: {
      origin: { x: 54, y: 42 },
      returnToStart: true,
      returnDuration: 1,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  경회루: {
    path: [[15, 47, 1]],
    options: {
      origin: { x: 57, y: 13 },
      returnToStart: true,
      returnDuration: 1,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  광화문2: {
    path: [
      [45, 66, 1],
      [39, 54, 1],
    ],
    options: {
      origin: { x: 39, y: 76 },
      returnToStart: true,
      returnDuration: 1,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  광화문포토존: {
    path: [[39, 43, 1]],
    options: {
      origin: { x: 39, y: 53 },
      returnToStart: true,
      returnDuration: 1,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
};

function normalizeWaypoint(
  waypoint: CameraWaypointInput
): NormalizedCameraWaypoint {
  if (Array.isArray(waypoint)) {
    const [x, y, duration] = waypoint;
    return { x, y, duration };
  }

  const { x, y, duration, time } = waypoint;
  return { x, y, duration: duration ?? time };
}

export function moveCamera(
  player: ScriptPlayer,
  path: CameraWaypointInput[],
  options: CameraMoveOptions = {}
): void {
  if (!path.length) {
    return;
  }

  const waypoints = path.map((waypoint) => normalizeWaypoint(waypoint));
  const defaultDuration = options.defaultDuration ?? DEFAULT_MOVE_DURATION;
  const waitBufferSeconds = options.waitBufferSeconds ?? DEFAULT_WAIT_BUFFER;
  const restoreMoveSpeed = options.restoreMoveSpeed ?? DEFAULT_MOVE_SPEED;
  const origin = options.origin ?? { x: player.tileX, y: player.tileY };

  const restoreCamera = (): void => {
    player.setCameraTarget("");
    player.moveSpeed = restoreMoveSpeed;
    player.sendUpdated();
  };

  const scheduleRestore = (delaySeconds: number): void => {
    setTimeout(() => {
      restoreCamera();
    }, delaySeconds * 1000);
  };

  const handleReturn = (): void => {
    if (options.returnToStart && origin) {
      const { x, y } = origin;
      const returnDuration =
        options.returnDuration ??
        options.defaultDuration ??
        DEFAULT_RETURN_DURATION;

      player.setCameraTarget(x, y, returnDuration);
      player.sendUpdated();
      scheduleRestore(returnDuration + waitBufferSeconds);
      return;
    }

    scheduleRestore(waitBufferSeconds);
  };

  const executeWaypoint = (index: number): void => {
    if (index >= waypoints.length) {
      handleReturn();
      return;
    }

    const { x, y, duration } = waypoints[index];
    const moveDuration = duration ?? defaultDuration;

    player.setCameraTarget(x, y, moveDuration);
    player.sendUpdated();

    setTimeout(() => {
      executeWaypoint(index + 1);
    }, (moveDuration + waitBufferSeconds) * 1000);
  };

  player.moveSpeed = 0;
  player.sendUpdated();
  executeWaypoint(0);
}

export function cameraMoveByMapName(
  player: ScriptPlayer,
  mapName: string
): void {
  const focus = cameraFocusRoutes[mapName];
  if (focus) {
    player.setCameraTarget(
      focus.x,
      focus.y,
      focus.moveDuration ?? 0.45
    );
    player.sendUpdated();
    setTimeout(() => {
      player.setCameraTarget("");
      player.sendUpdated();
    }, focus.durationMs);
    return;
  }

  const route = cameraRoutes[mapName];
  if (!route) {
    return;
  }

  moveCamera(player, route.path, route.options);
}
