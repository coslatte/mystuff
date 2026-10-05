import { player } from "../services/player";
import { playPauseClass, playPauseGlyph } from "./playback-ui";

const TOGGLE_BASE =
  "flex h-7 w-7 shrink-0 items-center justify-center border-2 border-black text-xs font-bold transition-colors";
const META_CLASS = "truncate font-mono text-xs font-bold leading-tight normal-case text-white";

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

    private idleBox = document.createElement("div");
    private box = document.createElement("div");
    private toggle = document.createElement("button");
    private icon = document.createElement("span");
    private metaTitle = document.createElement("span");
    private detail = document.createElement("span");

    // The store notifies on every timeupdate, so render() has to stay cheap.
    // Only the song identity and the play state reach the DOM.
    private shownSongId: number | null = null;
    private shownPlaying: boolean | null = null;

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
      this.box.append(this.toggle, meta);
    }

    connectedCallback() {
      this.replaceChildren(this.idleBox);
      this.unsubscribe = player.subscribe(() => this.render());
      this.render();
    }

    disconnectedCallback() {
      this.unsubscribe?.();
      this.unsubscribe = undefined;
    }

    render() {
      const { song, isPlaying } = player.getSnapshot();

      if (!song) {
        if (this.shownSongId === null) return;
        this.replaceChildren(this.idleBox);
        this.shownSongId = null;
        this.shownPlaying = isPlaying;
        return;
      }

      if (this.shownSongId !== song.id) {
        this.replaceChildren(this.box);
        this.metaTitle.textContent = song.title;
        this.detail.textContent = `${song.artist ? ` · ${song.artist}` : ""}${
          song.duration ? ` · ${song.duration}` : ""
        }`;
        this.shownSongId = song.id;
      }

      if (this.shownPlaying === isPlaying) return;
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
  }

  customElements.define("now-playing-el", NowPlayingEl);
}