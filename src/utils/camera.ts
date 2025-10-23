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

const DEFAULT_MOVE_DURATION = 1.5;
const DEFAULT_RETURN_DURATION = 1;
const DEFAULT_WAIT_BUFFER = 1;
const DEFAULT_MOVE_SPEED = 80;

const cameraRoutes: Record<string, CameraRouteConfig> = {
  종로시전_프롤로그: {
    path: [[41, 23, 1]],
    options: {
      origin: { x: 60, y: 67 },
      returnToStart: true,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  경공장_작업장: {
    path: [[46, 26, 1]],
    options: {
      origin: { x: 22, y: 9 },
      returnToStart: true,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  피마길: {
    path: [[76, 2, 1]],
    options: {
      origin: { x: 1, y: 24 },
      returnToStart: true,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  종로시전1: {
    path: [
      [20, 36, 1],
      [42, 22, 1],
      [93, 23, 1],
      [92, 51, 1],
      [23, 55, 1],
      [42, 64, 1],
    ],
    options: {
      origin: { x: 61, y: 67 },
      returnToStart: true,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  비단상점: {
    path: [[51, 39, 1]],
    options: {
      origin: { x: 23, y: 38 },
      returnToStart: true,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  종로시전2: {
    path: [[74, 69, 1]],
    options: {
      origin: { x: 39, y: 66 },
      returnToStart: true,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  종이상점: {
    path: [
      [19, 21, 1],
      [23, 39, 1],
    ],
    options: {
      origin: { x: 16, y: 39 },
      returnToStart: true,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  종로시전: {
    path: [[35, 29, 1]],
    options: {
      origin: { x: 72, y: 69 },
      returnToStart: true,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  경시서: {
    path: [
      [39, 24, 1],
      [51, 39, 1],
    ],
    options: {
      origin: { x: 22, y: 36 },
      returnToStart: true,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  종로시전4: {
    path: [
      [21, 37, 1],
      [39, 65, 1],
    ],
    options: {
      origin: { x: 97, y: 29 },
      returnToStart: true,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  비단상점2: {
    path: [[35, 34, 1]],
    options: {
      origin: { x: 22, y: 38 },
      returnToStart: true,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  종로시전5: {
    path: [[42, 21, 1]],
    options: {
      origin: { x: 45, y: 66 },
      returnToStart: true,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  경공장2: {
    path: [[38, 14, 1]],
    options: {
      origin: { x: 17, y: 10 },
      returnToStart: true,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  종로시전7: {
    path: [[122, 44, 1]],
    options: {
      origin: { x: 42, y: 22 },
      returnToStart: true,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  시전귀퉁이: {
    path: [[27, 21, 1]],
    options: {
      origin: { x: 12, y: 23 },
      returnToStart: true,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  종로길거리_아픈여성: {
    path: [[108, 37, 1]],
    options: {
      origin: { x: 124, y: 44 },
      returnToStart: true,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  제생원: {
    path: [[19, 37, 1]],
    options: {
      origin: { x: 6, y: 40 },
      returnToStart: true,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  종로길거리_장영실: {
    path: [[65, 14, 1]],
    options: {
      origin: { x: 100, y: 45 },
      returnToStart: true,
      defaultDuration: 1,
      waitBufferSeconds: 1,
    },
  },
  혜정교: {
    path: [[31, 5, 1]],
    options: {
      origin: { x: 29, y: 32 },
      returnToStart: true,
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
    if (options.returnToStart && options.origin) {
      const { x, y } = options.origin;
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
  const route = cameraRoutes[mapName];
  if (!route) {
    return;
  }

  moveCamera(player, route.path, route.options);
}
