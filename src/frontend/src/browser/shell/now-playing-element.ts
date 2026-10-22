import { player } from "../../services/player";
import { drawPseudoSpectrum, drawSpectrum, sizeCanvas } from "../audio/playback-canvas";
import { formatClock, playPauseClass, playPauseGlyph } from "../../lib/audio/playback-ui";

const TOGGLE_BASE =
  "flex h-11 w-11 shrink-0 items-center justify-center border-2 border-white text-sm font-bold transition-colors";
const CLOCK_CLASS = "shrink-0 font-mono text-[10px] font-bold tabular-nums text-white tablet:text-xs";
const TITLE_CLASS =
  "block truncate font-mono text-xs font-bold leading-tight text-brut-red tablet:text-sm";
const SQUARE_CLASS =
  "hidden h-full min-h-0 aspect-square shrink-0 border-2 border-neutral-700 bg-black p-0.5 tablet:block";

let registered = false;

/**
 * Renders outside React so pages without an island do not pull in react-dom for
 * one widget, while still sharing the PlayerEngine store PlayerBar reads.
 *
 * Registration is deferred to a call site because this module is also pulled
 * into the server render, where HTMLElement does not exist.
 */
export function defineNowPlaying() {
  if (registered || typeof HTMLElement === "undefined") return;
  if (customElements.get("now-playing-el")) {
    registered = true;
    return;
  }
  registered = true;

  class NowPlayingEl extends HTMLElement {
    unsubscribe: (() => void) | undefined;
    private frame: number | null = null;
    private resizeObserver: ResizeObserver | undefined;
    private reducedMotion = false;

    private box = document.createElement("div");
    private toggle = document.createElement("button");
    private icon = document.createElement("span");
    private elapsed = document.createElement("span");
    private songName = document.createElement("span");
    private total = document.createElement("span");
    private canvas = document.createElement("canvas");
    private loop = document.createElement("button");
    private volume = document.createElement("input");
    private shownLoop: boolean | null = null;
    private shownVolume: number | null = null;

    // The store notifies on every timeupdate, so render() has to stay cheap.
    // Only the song identity and the play state reach the DOM.
    private active = false;
    private shownKey: string | null = null;
    private shownElapsed: string | null = null;
    private shownPlaying: boolean | null = null;
    private shownControllable: boolean | null = null;

    constructor() {
      super();
      this.elapsed.className = CLOCK_CLASS;
      this.elapsed.hidden = true;
      this.total.className = CLOCK_CLASS;
      this.total.hidden = true;

      this.box.className =
        "flex h-full min-h-0 min-w-0 max-w-full items-center gap-3 border-2 border-black bg-black px-2 py-1";
      this.toggle.type = "button";
      this.toggle.addEventListener("click", () => player.toggle());
      this.icon.className = "icon-morph";
      this.toggle.append(this.icon);

      this.loop.type = "button";
      this.loop.className = "shrink-0 border-2 border-white px-2 py-1 font-mono text-[10px] font-bold text-white";
      this.loop.textContent = "↻ loop";
      this.loop.addEventListener("click", () => player.setLoop(!player.getSnapshot().loop));
      this.volume.type = "range";
      this.volume.min = "0";
      this.volume.max = "1";
      this.volume.step = "0.01";
      this.volume.className = "w-16 shrink-0 accent-brut-blue tablet:w-20";
      this.volume.addEventListener("input", () => player.setVolume(Number(this.volume.value)));

      this.songName.className = TITLE_CLASS;
      this.songName.translate = false;
      const name = document.createElement("p");
      name.className = "min-w-0";
      name.append(this.songName);

      // Built once and never replaced, so a track change repaints this canvas
      // instead of throwing away the backing store it already has.
      // h-full plus aspect-square is what lets the footer own the height: the
      // square follows the bar down instead of pushing the bar taller.
      const square = document.createElement("div");
      square.className = SQUARE_CLASS;
      square.setAttribute("aria-hidden", "true");
      this.canvas.className = "block h-full w-full";
      square.append(this.canvas);

      this.box.append(this.toggle, this.elapsed, name, this.loop, this.volume, this.total, square);
    }

    connectedCallback() {
      this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.replaceChildren(this.box);
      this.unsubscribe = player.subscribe(() => this.render());
      this.resizeObserver = new ResizeObserver(() => this.paint());
      this.resizeObserver.observe(this.canvas);
      this.render();
    }

    disconnectedCallback() {
      this.unsubscribe?.();
      this.unsubscribe = undefined;
      this.resizeObserver?.disconnect();
      this.resizeObserver = undefined;
      this.stopLoop();
    }

    /**
     * One frame of the log spectrum square. Own tracks paint measured analyser
     * data; every other source paints the synthetic stand-in, because a
     * cross-origin embed has no samples to analyse.
     */
    private paint() {
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
      const height = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
      if (!sizeCanvas(this.canvas, width, height)) return;
      const ctx = this.canvas.getContext("2d");
      if (!ctx) return;
      const { nowPlaying, isPlaying } = player.getSnapshot();
      const real = nowPlaying?.source === "tracks";
      if (real) {
        drawSpectrum(ctx, width, height, player.getAnalyser(), isPlaying);
        return;
      }
      const frozen = this.reducedMotion ? 0 : performance.now();
      drawPseudoSpectrum(ctx, width, height, nowPlaying?.key ?? "", frozen);
    }

    private startLoop() {
      if (this.frame != null) return;
      const animate = () => {
        // A background tab keeps its rAF queued but never fires it; skipping the
        // repaint there keeps a hidden footer from burning frames on nothing.
        if (!document.hidden) this.paint();
        this.frame = requestAnimationFrame(animate);
      };
      this.frame = requestAnimationFrame(animate);
    }

    private stopLoop() {
      if (this.frame != null) cancelAnimationFrame(this.frame);
      this.frame = null;
    }

    render() {
      const { nowPlaying, isPlaying, track } = player.getSnapshot();

      // The footer shows itself off this attribute, so the bar enters and leaves
      // the document with the widget rather than through a second state channel.
      if (!nowPlaying) {
        if (this.active) {
          this.active = false;
          this.removeAttribute("data-playing");
          this.shownKey = null;
        }
        this.stopLoop();
        return;
      }

      if (!this.active) {
        this.active = true;
        this.setAttribute("data-playing", "");
      }

      if (this.shownKey !== nowPlaying.key) {
        this.songName.textContent = nowPlaying.title;
        this.total.textContent = nowPlaying.durationLabel ?? "";
        this.total.hidden = !nowPlaying.durationLabel;
        this.shownKey = nowPlaying.key;
        this.paint();
      }

      // An embed never reports a position, so a frozen 0:00 there would be a
      // clock that lies about a track it cannot see.
      const elapsed = nowPlaying.source === "tracks" ? formatClock(track.currentTime) : "";
      if (this.shownElapsed !== elapsed) {
        this.shownElapsed = elapsed;
        this.elapsed.textContent = elapsed;
        this.elapsed.hidden = elapsed === "";
      }

      if (this.shownControllable !== nowPlaying.controllable) {
        this.shownControllable = nowPlaying.controllable;
        this.toggle.hidden = !nowPlaying.controllable;
      }

      if (this.shownLoop !== player.getSnapshot().loop) {
        this.shownLoop = player.getSnapshot().loop;
        this.loop.setAttribute("aria-pressed", String(this.shownLoop));
        this.loop.classList.toggle("bg-brut-blue", this.shownLoop);
      }
      if (this.shownVolume !== player.getSnapshot().volume) {
        this.shownVolume = player.getSnapshot().volume;
        this.volume.value = String(this.shownVolume);
      }

      if (this.shownPlaying !== isPlaying) {
        this.shownPlaying = isPlaying;
        this.toggle.className = playPauseClass(isPlaying, TOGGLE_BASE);
        this.toggle.setAttribute("aria-label", isPlaying ? "pause" : "play");
        // icon-morph only replays on a fresh node, so swap the glyph into a new
        // span instead of patching textContent.
        this.icon = document.createElement("span");
        this.icon.className = "icon-morph";
        this.icon.textContent = playPauseGlyph(isPlaying);
        this.toggle.replaceChildren(this.icon);
      }

      if (isPlaying && !this.reducedMotion) this.startLoop();
      else this.stopLoop();
    }
  }

  customElements.define("now-playing-el", NowPlayingEl);
}
