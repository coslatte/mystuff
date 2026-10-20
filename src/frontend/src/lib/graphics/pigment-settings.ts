/*
 * Every knob on the pigment board, in one object.
 *
 * The component used to hold fifteen separate pieces of state and pass them down as
 * twenty-eight props. That shape has no room for a preset, a saved session or a
 * keyboard shortcut, because each addition means another prop and another effect
 * that has to push its value into the simulation. One object makes the whole
 * configuration a value: comparable, copyable, serialisable, and the thing a preset
 * is.
 *
 * Ranges live here rather than on the sliders, so `sanitize` can enforce exactly
 * what the panel offers. A value restored from storage is untrusted input, and the
 * solver is the one place where an out-of-range value is not a wrong picture but a
 * frozen tab.
 */

import { HARMONY_NAMES, type HarmonyName } from "./color-theory";
import { FIELD_VIEW_MODES, type FieldViewMode } from "./sim/field-view";
import { LAYOUT_NAMES, type LayoutName } from "./sim/layouts";

export const DETAIL = { low: 1600, medium: 3600, high: 7200, ultra: 12800 } as const;
export type Detail = keyof typeof DETAIL;
export const DETAIL_NAMES = Object.keys(DETAIL) as Detail[];

/** Board edge in CSS pixels. The board is square, so this is the whole footprint. */
export const BOARD_SIZES = { s: 320, m: 480, l: 720, full: 0 } as const;
export type BoardSize = keyof typeof BOARD_SIZES;
export const BOARD_SIZE_NAMES = Object.keys(BOARD_SIZES) as BoardSize[];

export type PigmentSettings = {
  running: boolean;
  detail: Detail;
  layout: LayoutName;
  board: BoardSize;

  hue: number;
  harmony: HarmonyName;
  chroma: number;
  spread: number;
  ramp: number;
  /** Bumped by the reroll button. The hue it lands on is derived, never stored twice. */
  seed: number;

  heading: number;
  turbulence: number;
  speed: number;
  density: number;
  wash: number;
  sweep: number;
  iterations: number;
  velocityDamping: number;

  relief: number;

  fieldView: FieldViewMode;
  fieldGain: number;

  tracers: boolean;
  tracerCount: number;
  tracerTail: number;
  tracerLife: number;

  pointer: boolean;
  pointerRadius: number;
  pointerForce: number;
  pointerDeposit: number;
  pointerChannel: number;
};

export const DEFAULT_SETTINGS: PigmentSettings = {
  running: true,
  detail: "medium",
  layout: "tide",
  board: "m",

  hue: 24,
  harmony: "split",
  chroma: 0.2,
  spread: 1,
  ramp: 0.6,
  seed: 0,

  heading: 0,
  turbulence: 140,
  speed: 26,
  density: 6,
  wash: 0.4,
  sweep: 6,
  iterations: 14,
  velocityDamping: 0.12,

  relief: 0,

  fieldView: "off",
  fieldGain: 1,

  tracers: false,
  tracerCount: 900,
  tracerTail: 14,
  tracerLife: 4.5,

  pointer: false,
  pointerRadius: 18,
  pointerForce: 220,
  pointerDeposit: 0,
  pointerChannel: 0,
};

/**
 * Starting points, each a different regime rather than a different seed of one.
 *
 * They exist because the board has too many knobs to reach an interesting corner of
 * it by hand, and a knob nobody can find is a knob that is not there.
 */
export const PRESETS: Record<string, Partial<PigmentSettings>> = {
  tide: { layout: "tide", speed: 26, turbulence: 140, density: 6, wash: 0.4 },
  storm: { layout: "storm", speed: 46, turbulence: 320, density: 9, wash: 0.25, sweep: 4 },
  silt: { layout: "silt", speed: 14, turbulence: 60, density: 5, wash: 0.7, sweep: 14 },
  orbit: { layout: "orbit", speed: 34, turbulence: 240, density: 7, wash: 0.35, heading: 0 },
  ink: {
    layout: "silt",
    speed: 10,
    turbulence: 90,
    density: 4,
    wash: 0.9,
    relief: 0.55,
    tracers: true,
    tracerCount: 1400,
    tracerTail: 20,
    pointer: true,
    pointerForce: 260,
  },
  survey: {
    layout: "orbit",
    speed: 30,
    turbulence: 220,
    density: 6,
    wash: 0.5,
    fieldView: "curl",
    tracers: true,
    tracerCount: 700,
  },
};

export const PRESET_NAMES = Object.keys(PRESETS);


/** Accepted range per numeric field. Also the ranges the panel's sliders offer. */
export const RANGES: { [K in NumericKey]: [number, number] } = {
  hue: [0, 359],
  chroma: [0.02, 0.37],
  spread: [0, 1],
  ramp: [0, 1],
  seed: [0, 9999],
  heading: [-360, 360],
  turbulence: [0, 600],
  speed: [4, 90],
  density: [0.5, 20],
  wash: [0, 1.5],
  sweep: [0, 24],
  iterations: [4, 40],
  velocityDamping: [0, 3],
  relief: [0, 1],
  fieldGain: [0, 2],
  tracerCount: [0, 4000],
  tracerTail: [2, 48],
  tracerLife: [0.5, 20],
  pointerRadius: [2, 80],
  pointerForce: [0, 600],
  pointerDeposit: [0, 80],
  pointerChannel: [0, 7],
};

export type NumericKey = {
  [K in keyof PigmentSettings]: PigmentSettings[K] extends number ? K : never;
}[keyof PigmentSettings];

export type SettingsPatch = Partial<PigmentSettings>;

/**
 * Merges a patch over the defaults, rejecting anything the panel would not offer.
 *
 * Booleans and enumerations are checked against their own option lists rather than
 * being cast: an unknown `layout` in stored JSON has no emitters to call, and the
 * simulation would sit there doing nothing with no error to explain it.
 */
export function sanitize(base: PigmentSettings, patch: unknown): PigmentSettings {
  const out: PigmentSettings = { ...base };
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return out;
  const raw = patch as Record<string, unknown>;

  for (const key of Object.keys(RANGES) as NumericKey[]) {
    const value = raw[key];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const [min, max] = RANGES[key];
    out[key] = Math.min(max, Math.max(min, value));
  }

if (typeof raw.running === "boolean") out.running = raw.running;
  if (typeof raw.tracers === "boolean") out.tracers = raw.tracers;
  if (typeof raw.pointer === "boolean") out.pointer = raw.pointer;

  if (typeof raw.detail === "string" && DETAIL_NAMES.includes(raw.detail as Detail)) out.detail = raw.detail as Detail;
  if (typeof raw.board === "string" && BOARD_SIZE_NAMES.includes(raw.board as BoardSize)) out.board = raw.board as BoardSize;
  if (typeof raw.layout === "string" && LAYOUT_NAMES.includes(raw.layout as LayoutName)) out.layout = raw.layout as LayoutName;
  if (typeof raw.harmony === "string" && HARMONY_NAMES.includes(raw.harmony as HarmonyName)) out.harmony = raw.harmony as HarmonyName;
  if (typeof raw.fieldView === "string" && FIELD_VIEW_MODES.includes(raw.fieldView as FieldViewMode)) {
    out.fieldView = raw.fieldView as FieldViewMode;
  }

  return out;
}

/** Overlays a named preset, keeping everything the preset does not mention. */
export function applyPreset(current: PigmentSettings, name: string): PigmentSettings {
  const preset = PRESETS[name];
  return preset ? sanitize(current, preset) : current;
}

/** Snapshot for a preset download or a shareable link. */
export function serialize(settings: PigmentSettings): string {
  return JSON.stringify(settings);
}

export function deserialize(json: string): PigmentSettings {
  try {
    return sanitize(DEFAULT_SETTINGS, JSON.parse(json));
  } catch {
    return DEFAULT_SETTINGS;
  }
}