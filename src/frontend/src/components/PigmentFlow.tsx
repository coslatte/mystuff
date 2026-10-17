import { messages } from "../lib/i18n/catalog";
import { useTranslations } from "../lib/i18n/useTranslations";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildPalette, colorFor } from "../lib/color-theory";
import { makePigment } from "../lib/pigment-math";
import {
  applyPreset,
  BOARD_SIZES,
  DEFAULT_SETTINGS,
  PRESET_NAMES,
  rememberSettings,
  restoreSettings,
  sanitize,
} from "../lib/pigment-settings";
import type { PigmentSettings, SettingsPatch } from "../lib/pigment-settings";
import { createCamera, panBy, zoomAt, ZOOM_STEP } from "../lib/sim/camera";
import type { Camera } from "../lib/sim/camera";
import { FIELD_VIEW_MODES } from "../lib/sim/field-view";
import { mountPigmentBoard, type PigmentBoard } from "../lib/sim/pigment-board";
import PigmentControls from "./PigmentControls";

/** A slider fires faster than a session should be rewritten. */
const SAVE_DELAY_MS = 500;

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "space", label: "animate" },
  { keys: "r", label: "reset board" },
  { keys: "t", label: "tracers" },
  { keys: "p", label: "pointer stirs" },
  { keys: "f", label: "field view" },
  { keys: "wheel", label: "zoom" },
  { keys: "shift + drag", label: "pan" },
];

export default function PigmentFlow() {
  const t = useTranslations();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<PigmentBoard | null>(null);

  const [settings, setSettings] = useState<PigmentSettings>(DEFAULT_SETTINGS);
  const [camera, setCamera] = useState<Camera>(() => createCamera());
  const [controlsVisible, setControlsVisible] = useState(true);
  const [stats, setStats] = useState({ cells: 0, fps: 0, mixes: 0, traces: 0 });

  const latestSettings = useRef(settings);
  latestSettings.current = settings;

  const patch = useCallback((next: SettingsPatch) => {
    setSettings((current) => sanitize(current, next));
  }, []);

  // Restored after hydration rather than during render: the module body also runs on
  // the server, where there is no storage, so a restored first frame would not match
  // the server's markup.
  useEffect(() => {
    setSettings(restoreSettings());
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => rememberSettings(latestSettings.current), SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [settings]);

  const palette = useMemo(
    () =>
      buildPalette({
        hue: (settings.hue + settings.seed * 47) % 360,
        harmony: settings.harmony,
        chroma: settings.chroma,
        spread: settings.spread,
        ramp: settings.ramp,
        count: 4,
      }),
    [settings.hue, settings.harmony, settings.chroma, settings.spread, settings.ramp, settings.seed]
  );

  const pigments = useMemo(() => palette.hex.map((hex) => makePigment(colorFor(hex), 1, 1)), [palette]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const board = mountPigmentBoard(canvas, {
      settings, pigments, camera, onStats: setStats,
      onZoom: (factor, x, y) => setCamera(current => zoomAt(current, factor, x, y)),
      onPan: (dx, dy) => setCamera(current => panBy(current, dx, dy)),
    });
    boardRef.current = board;
    return () => {
      board?.dispose();
      boardRef.current = null;
    };
  }, []);

  useEffect(() => {
    boardRef.current?.update({ settings, pigments, camera });
  }, [settings, pigments, camera]);

  useEffect(() => {
    const typing = (target: EventTarget | null): boolean =>
      target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

    const onKeyDown = (event: KeyboardEvent): void => {
      if (typing(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === " ") {
        // Refused so the page does not scroll under the board, and handled on keyup
        // so a held key toggles the animation once rather than once per repeat.
        event.preventDefault();
        return;
      }

      if (event.key === "+" || event.key === "=") setCamera((current) => zoomAt(current, ZOOM_STEP));
      else if (event.key === "-") setCamera((current) => zoomAt(current, 1 / ZOOM_STEP));
      else if (event.key === "0") setCamera(createCamera());
      else if (event.key === "r") boardRef.current?.reset();
      else if (event.key === "t") patch({ tracers: !latestSettings.current.tracers });
      else if (event.key === "p") patch({ pointer: !latestSettings.current.pointer });
      else if (event.key === "f") {
        const order = FIELD_VIEW_MODES;
        const at = order.indexOf(latestSettings.current.fieldView);
        patch({ fieldView: order[(at + 1) % order.length] });
      } else {
        const preset = PRESET_NAMES[Number(event.key) - 1];
        if (preset && /^[1-9]$/.test(event.key)) {
          setSettings((current) => applyPreset(current, preset));
        }
      }
    };

    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.key === " " && !typing(event.target) && !event.metaKey && !event.ctrlKey && !event.altKey) {
        patch({ running: !latestSettings.current.running });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [patch]);

  const cursor = settings.pointer ? "cursor-cell" : "cursor-default";

  // The width goes on the panel, not the canvas. A canvas with no CSS width falls
  // back to its intrinsic size, which is the device-resolution backing store this
  // effect just wrote, so the board would grow by a device pixel ratio every resize.
  const boardSize = BOARD_SIZES[settings.board];
  const boardWidth = boardSize ? `${boardSize}px` : "100%";

  return (
    <div className="experiment-workspace flex flex-col gap-4 laptop:flex-row laptop:items-start">
      <section className="experiment-preview brut-panel relative max-w-full shrink-0 self-start" style={{ width: `min(${boardWidth}, var(--experiment-preview-size))` }}>
        <canvas
          ref={canvasRef}
          className={`block aspect-square w-full touch-none active:cursor-grabbing ${cursor}`}
          data-cursor={settings.pointer ? "precision" : undefined}
          aria-label={t(messages.experiments.boardInstructions)}
        />
        <p className="brut-meta absolute bottom-2 left-2 bg-brut-surface px-2 py-1 normal-case">
          {stats.cells}{t(messages.experiments.cells)}{stats.fps}{t(messages.experiments.fps)}{stats.mixes}{t(messages.experiments.mixes)}{stats.traces}{t(messages.experiments.traces)}{" "}
          {camera.zoom.toFixed(2)}{t.text("x")}</p>
      </section>

      {controlsVisible ? (
        <PigmentControls
          settings={settings}
          palette={palette.hex}
          camera={camera}
          onPatch={patch}
          onPreset={(name) => setSettings((current) => applyPreset(current, name))}
          onZoom={(factor) => setCamera((current) => zoomAt(current, factor))}
          onResetView={() => setCamera(createCamera())}
          onReset={() => boardRef.current?.reset()}
          onHide={() => setControlsVisible(false)}
          shortcuts={SHORTCUTS}
        />
      ) : (
        <button type="button" className="brut-btn self-start text-xs" onClick={() => setControlsVisible(true)}>{t(messages.experiments.showControls)}</button>
      )}
    </div>
  );
}
