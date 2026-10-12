/*
 * Controls for the pigment board.
 *
 * Presentational only, and deliberately uniform: every numeric knob is a
 * `SettingSlider` bound to one field of the settings object, taking its own range
 * from the table `sanitize` enforces. There is nowhere for a label and the solver to
 * disagree, and adding a knob is one line here plus one line in `pigment-settings`.
 */

import {
  BOARD_SIZE_NAMES,
  DETAIL_NAMES,
  PRESET_NAMES,
  RANGES,
  type BoardSize,
  type Detail,
  type NumericKey,
  type PigmentSettings,
  type SettingsPatch,
} from "../lib/pigment-settings";
import { FIELD_VIEW_MODES, type FieldViewMode } from "../lib/sim/field-view";
import { LAYOUT_NAMES, type LayoutName } from "../lib/sim/layouts";
import { MAX_ZOOM, MIN_ZOOM } from "../lib/sim/camera";
import { HARMONY_NAMES, type HarmonyName } from "../lib/color-theory";
import { Chips, Panel, Slider, Toggle } from "./controls";

type Props = {
  settings: PigmentSettings;
  palette: string[];
  camera: { zoom: number };
  shortcuts: { keys: string; label: string }[];
  onPatch: (patch: SettingsPatch) => void;
  onPreset: (name: string) => void;
  onZoom: (factor: number) => void;
  onResetView: () => void;
  onReset: () => void;
  onHide: () => void;
};

export default function PigmentControls({
  settings,
  palette,
  camera,
  shortcuts,
  onPatch,
  onPreset,
  onZoom,
  onResetView,
  onReset,
  onHide,
}: Props) {
  const set = <K extends keyof PigmentSettings>(field: K, value: PigmentSettings[K]): void =>
    onPatch({ [field]: value } as SettingsPatch);

  return (
    <div className="grid flex-1 grid-cols-1 content-start gap-3 tablet:grid-cols-2 laptop:grid-cols-2">
      <Panel title="board">
        <Toggle label="animate" checked={settings.running} onChange={(value) => set("running", value)} />
        <div className="flex gap-1">
          <button type="button" onClick={onReset} className="brut-btn flex-1 text-xs">
            reset
          </button>
          <button type="button" onClick={onHide} className="brut-btn flex-1 text-xs">
            hide
          </button>
        </div>
      </Panel>

      <Panel title="presets">
        <Chips label="load" value="" options={PRESET_NAMES} onChange={(name) => onPreset(name)} />
        <div className="flex items-stretch gap-1">
          {palette.map((hex) => (
            <div key={hex} className="h-8 flex-1 border-2 border-black" style={{ backgroundColor: hex }} />
          ))}
        </div>
        <button type="button" onClick={() => set("seed", settings.seed + 1)} className="brut-btn text-xs">
          reroll
        </button>
      </Panel>

      <Panel title="colour">
        <SettingSlider field="hue" settings={settings} onChange={set} format={(v) => `${v.toFixed(0)}°`} accent="text-brut-violet" />
        <Chips
          label="harmony"
          value={settings.harmony}
          options={HARMONY_NAMES}
          onChange={(harmony: HarmonyName) => set("harmony", harmony)}
        />
        <SettingSlider field="chroma" settings={settings} onChange={set} />
        <SettingSlider field="spread" settings={settings} onChange={set} />
        <SettingSlider field="ramp" settings={settings} onChange={set} />
      </Panel>

      <Panel title="motion">
        <Chips
          label="flow"
          value={settings.layout}
          options={LAYOUT_NAMES}
          onChange={(layout: LayoutName) => set("layout", layout)}
        />
        <SettingSlider
          field="heading"
          settings={settings}
          onChange={set}
          format={(v) => `${v.toFixed(0)}°`}
          accent="text-brut-red"
        />
        <SettingSlider field="turbulence" settings={settings} onChange={set} />
        <SettingSlider field="speed" settings={settings} onChange={set} format={(v) => `${v.toFixed(0)} c/s`} />
        <SettingSlider field="density" settings={settings} onChange={set} />
        <SettingSlider field="sweep" settings={settings} onChange={set} />
        <SettingSlider field="wash" settings={settings} onChange={set} accent="text-brut-red" />
        <SettingSlider field="velocityDamping" settings={settings} onChange={set} />
        <SettingSlider field="iterations" settings={settings} onChange={set} format={(v) => v.toFixed(0)} />
      </Panel>

      <Panel title="pointer">
        <Toggle label="stir with pointer" checked={settings.pointer} onChange={(value) => set("pointer", value)} />
        <SettingSlider field="pointerForce" settings={settings} onChange={set} format={(v) => `${v.toFixed(0)} c/s`} />
        <SettingSlider field="pointerRadius" settings={settings} onChange={set} />
        <SettingSlider
          field="pointerDeposit"
          settings={settings}
          onChange={set}
          hint="pigment dropped under the pointer, per second. 0 stirs without colouring."
        />
        <Chips
          label="dropped pigment"
          value={String(settings.pointerChannel)}
          options={palette.map((_, index) => String(index))}
          onChange={(channel) => set("pointerChannel", Number(channel))}
        />
      </Panel>

      <Panel title="tracers">
        <Toggle label="tracers" checked={settings.tracers} onChange={(value) => set("tracers", value)} />
        <SettingSlider field="tracerCount" settings={settings} onChange={set} format={(v) => v.toFixed(0)} />
        <SettingSlider field="tracerTail" settings={settings} onChange={set} />
        <SettingSlider field="tracerLife" settings={settings} onChange={set} />
      </Panel>

      <Panel title="surface">
        <SettingSlider
          field="relief"
          settings={settings}
          onChange={set}
          hint="lights the pigment by its own thickness."
        />
        <Chips
          label="field view"
          value={settings.fieldView}
          options={FIELD_VIEW_MODES as readonly FieldViewMode[]}
          onChange={(mode) => set("fieldView", mode)}
        />
        <SettingSlider field="fieldGain" settings={settings} onChange={set} />
      </Panel>

      <Panel title="view">
        <Chips
          label="board"
          value={settings.board}
          options={BOARD_SIZE_NAMES as readonly BoardSize[]}
          onChange={(board) => set("board", board)}
        />
        <Chips
          label="detail"
          value={settings.detail}
          options={DETAIL_NAMES as readonly Detail[]}
          onChange={(detail) => set("detail", detail)}
        />
        <Slider
          label="zoom"
          value={camera.zoom}
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.05}
          format={(v) => `${v.toFixed(2)}x`}
          onChange={(v) => onZoom(v / Math.max(camera.zoom, 0.0001))}
        />
        <button type="button" onClick={onResetView} className="brut-btn text-xs">
          reset view
        </button>
      </Panel>

      <Panel title="keys">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
          {shortcuts.map((shortcut) => (
            <div key={shortcut.keys} className="col-span-2 grid grid-cols-subgrid">
              <dt className="font-bold">{shortcut.keys}</dt>
              <dd className="font-normal normal-case text-gray-600">{shortcut.label}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}

type SliderProps = {
  field: NumericKey;
  settings: PigmentSettings;
  onChange: <K extends keyof PigmentSettings>(field: K, value: PigmentSettings[K]) => void;
  format?: (value: number) => string;
  accent?: string;
  hint?: string;
};

function SettingSlider({ field, settings, onChange, format, accent, hint }: SliderProps) {
  const [min, max] = RANGES[field];
  const span = max - min;
  return (
    <Slider
      label={field}
      value={settings[field]}
      min={min}
      max={max}
      step={span > 40 ? 1 : span / 100}
      format={format}
      accent={accent}
      hint={hint}
      onChange={(value) => onChange(field, value as PigmentSettings[NumericKey])}
    />
  );
}