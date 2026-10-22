import { player } from "../../services/player";
import { getLocale, subscribeLocale } from "../../services/locale";
import { messages } from "../../lib/i18n/catalog";
import { translate } from "../../lib/i18n/translate";

// Both React and the persistent footer mount this controller to share interaction and cleanup.
export function mountVolumeControl(host: HTMLElement) {
  const track = document.createElement("div");
  track.className = "volume-wake-track";
  track.tabIndex = 0;
  track.setAttribute("role", "slider");
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");
  const bars = Array.from({ length: 28 }, () => {
    const bar = document.createElement("span");
    bar.className = "volume-wake-bar";
    bar.setAttribute("aria-hidden", "true");
    track.append(bar);
    return bar;
  });
  const reading = document.createElement("span");
  reading.className = "volume-wake-value";
  reading.setAttribute("aria-hidden", "true");
  host.replaceChildren(track, reading);
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const energy = new Float32Array(bars.length);
  let frame = 0;
  let lastFrame = 0;
  let pointer: number | null = null;
  let lastX = 0;
  let lastTime = 0;
  let speed = 0;

  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    energy.fill(0);
    bars.forEach(bar => { bar.style.transform = ""; });
  };
  const animate = (now: number) => {
    const fall = Math.exp(-Math.min(0.05, (now - lastFrame) / 1000) * 6.5);
    lastFrame = now;
    let live = false;
    energy.forEach((value, index) => {
      energy[index] = value * fall < 0.002 ? 0 : value * fall;
      live ||= energy[index] > 0;
      bars[index].style.transform = `scaleY(${1 + energy[index] * 1.6})`;
    });
    frame = live ? requestAnimationFrame(animate) : 0;
  };
  const setValue = (value: number, velocity: number) => {
    const next = Math.max(0, Math.min(1, value));
    const from = Math.round(player.getSnapshot().volume * (bars.length - 1));
    const to = Math.round(next * (bars.length - 1));
    if (!motion.matches && !document.hidden) {
      const push = 1 - Math.exp(-velocity / 900);
      for (let index = Math.min(from, to); index <= Math.max(from, to); index++) {
        energy[index] = Math.max(energy[index], push);
      }
      if (!frame && push > 0) {
        lastFrame = performance.now();
        frame = requestAnimationFrame(animate);
      }
    }
    player.setVolume(Math.round(next * 100) / 100);
  };
  const fraction = (clientX: number) => {
    const rect = track.getBoundingClientRect();
    return (clientX - rect.left) / Math.max(1, rect.width);
  };
  track.onpointerdown = event => {
    if (event.button !== 0) return;
    pointer = event.pointerId;
    track.setPointerCapture(pointer);
    track.focus({ preventScroll: true });
    lastX = event.clientX;
    lastTime = performance.now();
    speed = 0;
    setValue(fraction(event.clientX), 0);
  };
  track.onpointermove = event => {
    if (pointer !== event.pointerId) return;
    const now = performance.now();
    speed = speed * 0.5 + Math.abs(event.clientX - lastX) / Math.max(0.008, (now - lastTime) / 1000) * 0.5;
    lastX = event.clientX;
    lastTime = now;
    setValue(fraction(event.clientX), speed);
  };
  const release = () => {
    if (pointer !== null && track.hasPointerCapture(pointer)) track.releasePointerCapture(pointer);
    pointer = null;
  };
  track.onpointerup = release;
  track.onpointercancel = release;
  track.onlostpointercapture = () => { pointer = null; };
  track.onkeydown = event => {
    const value = player.getSnapshot().volume;
    const step = event.shiftKey ? 0.1 : 0.01;
    let next: number;
    switch (event.key) {
      case "ArrowRight": case "ArrowUp": next = value + step; break;
      case "ArrowLeft": case "ArrowDown": next = value - step; break;
      case "Home": next = 0; break;
      case "End": next = 1; break;
      default: return;
    }
    event.preventDefault();
    setValue(next, 600);
  };
  let shown = -1;
  const render = () => {
    const value = Math.round(player.getSnapshot().volume * 100);
    if (shown === value) return;
    shown = value;
    track.setAttribute("aria-valuenow", String(value));
    track.setAttribute("aria-valuetext", `${value}%`);
    reading.textContent = `${value}%`;
    bars.forEach((bar, index) => { bar.dataset.on = String(index < Math.round(value / 100 * bars.length)); });
  };
  const localize = () => { track.setAttribute("aria-label", translate(messages.music.volume, getLocale())); };
  const unsubscribe = player.subscribe(render);
  const unsubscribeLocale = subscribeLocale(localize);
  motion.addEventListener("change", stop);
  document.addEventListener("visibilitychange", stop);
  render();
  localize();
  return () => {
    release();
    stop();
    unsubscribe();
    unsubscribeLocale();
    motion.removeEventListener("change", stop);
    document.removeEventListener("visibilitychange", stop);
    host.replaceChildren();
  };
}
