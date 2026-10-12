import { player } from "../services/player";
import { drawPseudoSpectrum, drawSpectrum, sizeCanvas } from "./playback-canvas";
import { playPauseClass, playPauseGlyph } from "./playback-ui";

const TOGGLE_BASE =
  "flex h-7 w-7 shrink-0 items-center justify-center border-2 border-black text-xs font-bold transition-colors";
const META_CLASS = "truncate font-mono text-xs font-bold leading-tight normal-case text-white";
const SQUARE_CLASS =
  "hidden shrink-0 border-2 border-neutral-700 bg-black p-0.5 tablet:block";

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

    private idleBox = document.createElement("div");
    private box = document.createElement("div");
    private toggle = document.createElement("button");
    private icon = document.createElement("span");
    private metaTitle = document.createElement("span");
    private detail = document.createElement("span");
    private canvas = document.createElement("canvas");

    // The store notifies on every timeupdate, so render() has to stay cheap.
    // Only the song identity and the play state reach the DOM.
    private shownKey: string | null = null;
    private shownPlaying: boolean | null = null;
    private shownControllable: boolean | null = null;

    constructor() {
      super();
      this.idleBox.className =
        "border-2 border-black bg-black px-3 py-1 font-mono text-xs font-bold normal-case text-white";
      this.idleBox.textContent = "nothing playing";

      this.box.className = "flex min-w-0 items-center gap-3 border-2 border-black bg-black p-2";
      this.toggle.type = "button";
      this.toggle.addEventListener("click", () => player.toggle());
      this.icon.className = "icon-morph";
      this.toggle.append(this.icon);

      this.metaTitle.className = "text-brut-red";
      const meta = document.createElement("p");
      meta.className = META_CLASS;
      meta.append(this.metaTitle, this.detail);

      // Built once and never replaced: the idle/playing swap swaps whole subtrees,
      // so a canvas rebuilt here would throw away its backing store every track.
      const square = document.createElement("div");
      square.className = SQUARE_CLASS;
      square.setAttribute("aria-hidden", "true");
      this.canvas.className = "block h-14 w-14";
      square.append(this.canvas);

      this.box.append(this.toggle, meta, square);
    }

    connectedCallback() {
      this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.replaceChildren(this.idleBox);
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
      const { nowPlaying, isPlaying } = player.getSnapshot();

      if (!nowPlaying) {
        if (this.shownKey === null) return;
        this.replaceChildren(this.idleBox);
        this.shownKey = null;
        this.shownPlaying = isPlaying;
        this.shownControllable = null;
        this.stopLoop();
        return;
      }

      if (this.shownKey !== nowPlaying.key) {
        this.replaceChildren(this.box);
        this.metaTitle.textContent = nowPlaying.title;
        this.detail.textContent = `${nowPlaying.artist ? ` · ${nowPlaying.artist}` : ""}${
          nowPlaying.durationLabel ? ` · ${nowPlaying.durationLabel}` : ""
        }`;
        this.shownKey = nowPlaying.key;
        this.paint();
      }

      if (this.shownControllable !== nowPlaying.controllable) {
        this.shownControllable = nowPlaying.controllable;
        this.toggle.hidden = !nowPlaying.controllable;
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