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
  피마길: {
    path: [[33, 37]],
    options: { origin: { x: 33, y: 59 }, returnToStart: true },
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
    options: { origin: { x: 61, y: 67 }, returnToStart: true },
  },
  근정전2번: {
    path: [[46, 34]],
    options: { origin: { x: 16, y: 54 }, returnToStart: true },
  },
  근정전내부1번: {
    path: [[22, 32]],
    options: { origin: { x: 33, y: 59 }, returnToStart: true },
  },
  근정전내부2번: {
    path: [[33, 37]],
    options: { origin: { x: 33, y: 59 }, returnToStart: true },
  },
  사정전낮: {
    path: [[23, 33]],
    options: { origin: { x: 33, y: 57 }, returnToStart: true },
  },
  사정전밤: {
    path: [[33, 30]],
    options: { origin: { x: 32, y: 60 }, returnToStart: true },
  },
  집현전내부: {
    path: [[26, 29]],
    options: { origin: { x: 13, y: 46 }, returnToStart: true },
  },
  집현전외부: {
    path: [[50, 39]],
    options: { origin: { x: 49, y: 50 }, returnToStart: true },
  },
  경회루일반: {
    path: [[74, 25]],
    options: { origin: { x: 30, y: 30 }, returnToStart: true },
  },
  경회루기녀: {
    path: [[27, 33]],
    options: { origin: { x: 70, y: 22 }, returnToStart: true },
  },
  강녕전외부: {
    path: [[92, 28]],
    options: { origin: { x: 48, y: 43 }, returnToStart: true },
  },
  강녕전외부2: {
    path: [[83, 34]],
    options: { origin: { x: 47, y: 43 }, returnToStart: true },
  },
  바람: {
    path: [[23, 9]],
    options: { origin: { x: 23, y: 124 }, returnToStart: true },
  },
  강녕전내부: {
    path: [[25, 19]],
    options: { origin: { x: 32, y: 62 }, returnToStart: true },
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
