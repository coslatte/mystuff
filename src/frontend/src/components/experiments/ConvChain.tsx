import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "../../hooks/useTranslations";
import { messages } from "../../lib/i18n/catalog";
import { createConvChain, learnConvChain, type ConvChain as Chain, type PatternSize } from "../../lib/graphics/conv-chain";
import { paintConvChain } from "../../browser/experiments/conv-chain-canvas";
import { Panel, Slider, Toggle } from "./controls";

const PRESETS = [
  { label: messages.experiments.convChainRooms, rows: ["11111111", "10001000", "10001000", "10001000", "11111111", "00100010", "00100010", "00100010"] },
  { label: messages.experiments.convChainWeave, rows: ["11001100", "11001100", "00110011", "00110011", "11001100", "11001100", "00110011", "00110011"] },
  { label: messages.experiments.convChainPaths, rows: ["10000001", "11000011", "01100110", "00111100", "00111100", "01100110", "11000011", "10000001"] },
  { label: messages.experiments.convChainIslands, rows: ["00000000", "01100110", "01100110", "00000000", "00011000", "00011000", "00000000", "00000000"] },
];
const integer = (value: number) => value.toFixed(0);

export default function ConvChain() {
  const t = useTranslations();
  const canvas = useRef<HTMLCanvasElement>(null);
  const chain = useRef<Chain | null>(null);
  const [sample, setSample] = useState(PRESETS[0].rows);
  const [preset, setPreset] = useState("0");
  const [patternSize, setPatternSize] = useState<PatternSize>(3);
  const [size, setSize] = useState(48);
  const [temperature, setTemperature] = useState(1);
  const [symmetry, setSymmetry] = useState(true);
  const [seed, setSeed] = useState(7);
  const [iterations, setIterations] = useState(20);
  const [speed, setSpeed] = useState(4);
  const [running, setRunning] = useState(false);
  const [sweeps, setSweeps] = useState(0);
  const [ink, setInk] = useState("#2448c8");
  const [paper, setPaper] = useState("#f3f1eb");
  const [tiled, setTiled] = useState(false);
  const model = useMemo(() => learnConvChain(sample, patternSize, symmetry), [sample, patternSize, symmetry]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    setRunning(!preference.matches);
    const pause = () => { if (preference.matches) setRunning(false); };
    preference.addEventListener("change", pause);
    return () => preference.removeEventListener("change", pause);
  }, []);

  useEffect(() => {
    chain.current = createConvChain(model, size, seed);
    setSweeps(0);
  }, [model, size, seed]);

  useEffect(() => {
    const current = chain.current;
    const element = canvas.current;
    if (!current || !element) return;
    const paint = () => paintConvChain(element, current.cells, size, ink, paper, tiled);
    paint();
    if (!running) return;
    let frame = 0;
    let live = true;
    let previous = performance.now();
    let credit = 0;
    const tick = (now: number) => {
      const elapsed = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      if (document.hidden) { frame = requestAnimationFrame(tick); return; }
      credit = Math.min(size * size, credit + elapsed * speed * size * size);
      const until = performance.now() + 5;
      const target = iterations * size * size;
      while (credit >= 1 && current.attempts < target && performance.now() < until) {
        const count = Math.min(128, Math.floor(credit), target - current.attempts);
        current.step(count, temperature);
        credit -= count;
      }
      paint();
      setSweeps(current.attempts / (size * size));
      if (current.attempts >= target) setRunning(false);
      else if (live) frame = requestAnimationFrame(tick);
    };
    if (current.attempts < iterations * size * size) frame = requestAnimationFrame(tick);
    else setRunning(false);
    return () => { live = false; cancelAnimationFrame(frame); };
  }, [model, size, seed, running, temperature, iterations, speed, ink, paper, tiled]);

  const step = () => {
    setRunning(false);
    const current = chain.current;
    if (!current || !canvas.current) return;
    current.step(size * size, temperature);
    paintConvChain(canvas.current, current.cells, size, ink, paper, tiled);
    setSweeps(current.attempts / (size * size));
  };

  const download = () => {
    canvas.current?.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `convchain-${seed}-${size}.png`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  };

  return (
    <div className="experiment-workspace grid grid-cols-1 gap-4 laptop:grid-cols-[minmax(0,1fr)_21rem]" data-conv-chain>
      <section className="experiment-preview brut-panel relative self-start">
        <canvas ref={canvas} width={size} height={size} role="img" aria-label={t(messages.experiments.convChainOutput)}
          className="block aspect-square w-full" style={{ imageRendering: "pixelated" }} />
        <p className="brut-meta bg-brut-surface px-2 py-1 normal-case" aria-live="off" data-conv-chain-progress>
          {t(messages.experiments.convChainProgress, { current: sweeps.toFixed(1), total: iterations })}
        </p>
      </section>
      <div className="flex min-w-0 flex-col gap-3">
        <Panel title={t(messages.experiments.convChainSample)}>
          <label className="brut-label flex flex-col gap-1">
            {t(messages.experiments.presets)}
            <select value={preset} className="border-2 border-brut-black bg-brut-surface p-2 text-brut-black" onChange={event => {
              const value = event.target.value;
              const selected = PRESETS[Number(value)];
              if (selected) { setPreset(value); setSample(selected.rows); }
            }}>
              {PRESETS.map((entry, i) => <option key={i} value={String(i)}>{t(entry.label)}</option>)}
              <option value="custom" disabled>{t(messages.experiments.convChainCustom)}</option>
            </select>
          </label>
          <div className="grid aspect-square w-full max-w-64 grid-cols-8 border-2 border-brut-black" role="group" aria-label={t(messages.experiments.convChainSample)}>
            {sample.flatMap((row, y) => [...row].map((pixel, x) => (
              <button type="button" key={`${x}-${y}`} aria-pressed={pixel === "1"}
                aria-label={t(messages.experiments.convChainPixel, { x: x + 1, y: y + 1 })}
                className="aspect-square min-w-0 border border-brut-line focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brut-blue"
                style={{ backgroundColor: pixel === "1" ? ink : paper }} onClick={() => {
                  setPreset("custom");
                  setSample(rows => rows.map((line, j) => j === y ? line.slice(0, x) + (line[x] === "1" ? "0" : "1") + line.slice(x + 1) : line));
                }} />
            )))}
          </div>
          <p className="brut-meta normal-case text-brut-muted">{t(messages.experiments.convChainSampleHint)}</p>
          <Toggle label={t(messages.experiments.convChainSymmetry)} checked={symmetry} onChange={setSymmetry} />
        </Panel>
        <Panel title={t(messages.experiments.convChainGenerator)}>
          <label className="brut-label flex flex-col gap-1">
            {t(messages.experiments.convChainPattern)}
            <select value={patternSize} className="border-2 border-brut-black bg-brut-surface p-2 text-brut-black" onChange={event => {
              const n = Number(event.target.value);
              if (n === 2 || n === 3 || n === 4) setPatternSize(n);
            }}>
              {[2, 3, 4].map(n => <option key={n} value={n}>{n} × {n}</option>)}
            </select>
          </label>
          <Slider label={t(messages.experiments.convChainTemperature)} value={temperature} min={0.1} max={2} step={0.05} onChange={setTemperature} hint={t(messages.experiments.convChainTemperatureHint)} />
          <Slider label={t(messages.experiments.convChainSize)} value={size} min={16} max={64} step={8} format={value => `${value} × ${value}`} onChange={setSize} />
          <Slider label={t(messages.experiments.iterations)} value={iterations} min={1} max={100} step={1} format={integer} onChange={setIterations} />
          <Slider label={t(messages.experiments.convChainRate)} value={speed} min={0.5} max={20} step={0.5} onChange={setSpeed} />
          <label className="brut-label flex flex-col gap-1">
            {t(messages.experiments.convChainSeed)}
            <input type="number" min={0} max={999999} step={1} value={seed} className="w-full border-2 border-brut-black bg-brut-surface p-2 text-brut-black" onChange={event => {
              const value = event.target.valueAsNumber;
              if (Number.isInteger(value) && value >= 0 && value <= 999999) setSeed(value);
            }} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="brut-btn text-xs" aria-pressed={running} onClick={() => {
              if (!running && sweeps >= iterations) {
                chain.current = createConvChain(model, size, seed);
                setSweeps(0);
              }
              setRunning(value => !value);
            }}>{t(running ? messages.experiments.convChainPause : messages.experiments.convChainRun)}</button>
            <button type="button" className="brut-btn text-xs" onClick={step}>{t(messages.experiments.convChainStep)}</button>
            <button type="button" className="brut-btn text-xs" onClick={() => { chain.current = createConvChain(model, size, seed); setSweeps(0); if (canvas.current) paintConvChain(canvas.current, chain.current.cells, size, ink, paper, tiled); setRunning(false); }}>{t(messages.experiments.reset)}</button>
            <button type="button" className="brut-btn text-xs" onClick={() => setSeed(value => (value + 1) % 1000000)}>{t(messages.experiments.reroll)}</button>
          </div>
        </Panel>
        <Panel title={t(messages.experiments.output)}>
          <div className="grid grid-cols-2 gap-3">
            <label className="brut-label flex flex-col gap-1">{t(messages.experiments.convChainInk)}<input type="color" value={ink} onChange={event => setInk(event.target.value)} className="h-10 w-full cursor-pointer" /></label>
            <label className="brut-label flex flex-col gap-1">{t(messages.experiments.convChainPaper)}<input type="color" value={paper} onChange={event => setPaper(event.target.value)} className="h-10 w-full cursor-pointer" /></label>
          </div>
          <Toggle label={t(messages.experiments.convChainTile)} checked={tiled} onChange={setTiled} />
          <button type="button" className="brut-btn text-xs" onClick={download}>{t(messages.experiments.convChainDownload)}</button>
        </Panel>
      </div>
    </div>
  );
}
