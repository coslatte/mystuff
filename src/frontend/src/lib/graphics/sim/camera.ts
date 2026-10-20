/*
 * View transform for a simulation grid.
 *
 * Zoom and pan as pure arithmetic on a normalised centre, so nothing here knows a
 * canvas exists and every mapping can be checked by reading it. The component owns
 * the drawImage calls; this decides what they draw.
 *
 * `zoom` is isotropic and expressed as "how much of the field is magnified", so 1
 * is the whole board. The visible window is `1 / zoom` of each axis, centred on
 * `cx, cy`, which keeps the two axes locked together: the grid aspect already
 * matches the board, so any other scheme stretches the picture at one zoom level
 * and not at the next.
 */

export type Rect = { x: number; y: number; width: number; height: number };

/** Normalised view centre plus magnification. */
export type Camera = { zoom: number; cx: number; cy: number };

/** What the camera maps between: the solver's grid and the board's pixels. */
export type Frame = {
  gridWidth: number;
  gridHeight: number;
  boardWidth: number;
  boardHeight: number;
};

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;

/** One wheel notch, as a multiplier. Chosen to land on round zoom levels. */
export const ZOOM_STEP = 1.25;

export function createCamera(zoom = 1): Camera {
  return clampCamera({ zoom, cx: 0.5, cy: 0.5 });
}

/**
 * Forces the camera inside what the field can actually show.
 *
 * A clamp, not a remap. Every caller arrives with a centre that is already in board
 * coordinates — `panBy` adds to the last one, `zoomAt` pins an anchor against the
 * last one — so reinterpreting the incoming value as a free 0..1 offset silently
 * undoes the anchoring: the centre that lands exactly on the window's left edge
 * comes back out a fifth of the way across it, and a full-width drag moves the
 * board by less than a full width.
 *
 * At zoom 1 the window covers the whole board and the clamp pins the centre to 0.5,
 * so panning into empty space at the edges is impossible rather than merely
 * discouraged.
 */
export function clampCamera(camera: Camera): Camera {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom));
  const halfX = 0.5 / zoom;
  const halfY = 0.5 / zoom;
  return {
    zoom,
    cx: clamp(camera.cx, halfX, 1 - halfX),
    cy: clamp(camera.cy, halfY, 1 - halfY),
  };
}

/**
 * Zooms about a point on the board, in normalised 0..1 board coordinates.
 *
 * The point under the cursor has to stay under the cursor, which means the centre
 * moves *toward* the anchor in proportion to how much the window shrank. Anchoring
 * on the old centre instead is the version that feels broken: the board slides out
 * from under the pointer exactly when you are trying to line something up, and the
 * two forms only agree at a step of exactly 1.25x, which is why the drift hides in
 * a build where one wheel notch happens to match the test.
 */
export function zoomAt(camera: Camera, factor: number, anchorX = 0.5, anchorY = 0.5): Camera {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom * factor));
  if (zoom === camera.zoom) return camera;
  const ratio = camera.zoom / zoom;
  const pinned = (anchor: number, centre: number): number => anchor + (centre - anchor) * ratio;
  return clampCamera({ zoom, cx: pinned(anchorX, camera.cx), cy: pinned(anchorY, camera.cy) });
}

/** Pans by a fraction of the visible window, so a drag tracks the cursor at any zoom. */
export function panBy(camera: Camera, dx: number, dy: number): Camera {
  return clampCamera({ ...camera, cx: camera.cx + dx / camera.zoom, cy: camera.cy + dy / camera.zoom });
}

/** The visible window, in grid cells. This is the source rect of the field draw. */
export function viewRect(camera: Camera, frame: Frame): Rect {
  const width = frame.gridWidth / camera.zoom;
  const height = frame.gridHeight / camera.zoom;
  return { x: (camera.cx - 0.5 / camera.zoom) * frame.gridWidth, y: (camera.cy - 0.5 / camera.zoom) * frame.gridHeight, width, height };
}

/** Grid cells to board pixels. */
export function project(camera: Camera, frame: Frame, cellX: number, cellY: number): { x: number; y: number } {
  const view = viewRect(camera, frame);
  return {
    x: ((cellX - view.x) / view.width) * frame.boardWidth,
    y: ((cellY - view.y) / view.height) * frame.boardHeight,
  };
}

/** Board pixels to grid cells. The inverse of `project`, for the pointer. */
export function unproject(camera: Camera, frame: Frame, boardX: number, boardY: number): { x: number; y: number } {
  const view = viewRect(camera, frame);
  return {
    x: view.x + (boardX / Math.max(1, frame.boardWidth)) * view.width,
    y: view.y + (boardY / Math.max(1, frame.boardHeight)) * view.height,
  };
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}