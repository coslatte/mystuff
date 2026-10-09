import { formatClock } from "../lib/playback-ui";
import { player, type ExternalReport } from "./player";

/*
 * SoundCloud and Spotify embeds are cross-origin iframes: their own widget APIs
 * report what they are playing and nothing more. The audio itself is
 * unreachable from page script, so neither mount can ever produce a real
 * spectrum. Each mount hands the store a transport plus whatever identity it can
 * honestly claim, and returns a teardown that works whether or not the platform
 * script ever loaded.
 */

const SOUNDCLOUD_SCRIPT = "https://w.soundcloud.com/player/api.js";
const SPOTIFY_SCRIPT = "https://open.spotify.com/embed/iframe-api/v1";

export type EmbedIdentity = {
  /** Stable across renders, so the widget can diff on it instead of on title. */
  key: string;
  /** Shown until the platform reports something better. */
  fallbackTitle: string;
};

export type EmbedTeardown = () => void;

type EmbedSource = ExternalReport["source"];

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`could not load ${src}`));
    document.head.append(el);
  });
}

/** A mounted embed the page can no longer hear from: title only, no transport. */
function inertToken(source: EmbedSource, identity: EmbedIdentity): number {
  const token = player.attachExternal({ toggle: () => {}, pause: () => {} });
  player.reportExternal(token, {
    source,
    key: identity.key,
    title: identity.fallbackTitle,
    isPlaying: false,
    controllable: false,
  });
  return token;
}

/**
 * Binds the SoundCloud widget API to the plain iframe the page already rendered,
 * so the existing embed URL and height keep working untouched.
 */
export function mountSoundCloud(
  iframe: HTMLIFrameElement,
  identity: EmbedIdentity
): EmbedTeardown {
  let token: number | null = null;
  let disposed = false;

  void loadScript(SOUNDCLOUD_SCRIPT).then(
    () => {
      if (disposed) return;
      const Widget = window.SC?.Widget;
      if (!Widget) {
        token = inertToken("soundcloud", identity);
        return;
      }
      const widget = Widget(iframe);
      let current: SoundCloudSound | undefined;

      const report = (isPlaying: boolean) => {
        if (token == null) return;
        player.reportExternal(token, {
          source: "soundcloud",
          key: current?.id != null ? `sc:${current.id}` : identity.key,
          title: current?.title || identity.fallbackTitle,
          artist: current?.user?.username,
          durationLabel: current?.duration ? formatClock(current.duration / 1000) : undefined,
          isPlaying,
          controllable: true,
        });
      };

      token = player.attachExternal({
        toggle: () => widget.toggle(),
        pause: () => widget.pause(),
      });
      widget.bind(Widget.Events.PLAY, () => {
        widget.getCurrentSound((sound) => {
          current = sound;
          report(true);
        });
      });
      widget.bind(Widget.Events.PAUSE, () => report(false));
      widget.bind(Widget.Events.FINISH, () => report(false));
    },
    () => {
      if (!disposed) token = inertToken("soundcloud", identity);
    }
  );

  return () => {
    disposed = true;
    if (token != null) player.releaseExternal(token);
  };
}

/**
 * Spotify's iFrame API does not attach to an existing iframe: `createController`
 * replaces the container with its own embed, which is why this mounts into an
 * empty element instead of the iframe the SoundCloud path uses.
 *
 * The name comes from the API rather than from Spotify. Its playback events
 * carry a `playingURI` and never a track name, so the widget shows the release
 * rather than a name it would have to invent.
 */
export function mountSpotify(
  container: HTMLElement,
  identity: EmbedIdentity & { url: string; height: number }
): EmbedTeardown {
  let token: number | null = null;
  let disposed = false;

  void spotifyApi().then(
    (api) => {
      if (disposed) return;
      if (!api) {
        token = inertToken("spotify", identity);
        return;
      }
      const mounted = player.attachExternal({
        toggle: () => controller?.togglePlay(),
        pause: () => controller?.pause(),
      });
      token = mounted;
      let controller: SpotifyEmbedController | null = null;

      const report = (isPlaying: boolean) => {
        player.reportExternal(mounted, {
          source: "spotify",
          key: identity.key,
          title: identity.fallbackTitle,
          isPlaying,
          controllable: true,
        });
      };

      // `url` keeps the `theme=0` param, which the embed player preserves, so the
      // light embed survives giving up the hand-built src.
      try {
        api.createController(
          container,
          { url: identity.url, height: identity.height },
          (created) => {
            if (disposed) {
              created.destroy();
              return;
            }
            controller = created;
            created.addListener("playback_started", () => report(true));
            created.addListener("playback_update", (event) => {
              report(event.data?.isPaused === false);
            });
          }
        );
      } catch {
        // A container it refuses to adopt leaves the fallback iframe in place,
        // which still plays; it just stops reporting.
      }
    },
    () => {
      if (!disposed) token = inertToken("spotify", identity);
    }
  );

  return () => {
    disposed = true;
    if (token != null) player.releaseExternal(token);
  };
}

let spotifyApiPromise: Promise<SpotifyIFrameApi | null> | null = null;

function spotifyApi(): Promise<SpotifyIFrameApi | null> {
  if (spotifyApiPromise) return spotifyApiPromise;
  spotifyApiPromise = new Promise<SpotifyIFrameApi | null>((resolve) => {
    // Must exist before the script runs: Spotify calls it with the API object as
    // its own load hook, and the script never fires it a second time.
    window.onSpotifyIframeApiReady = resolve;
    loadScript(SPOTIFY_SCRIPT).catch(() => {
      window.onSpotifyIframeApiReady = undefined;
      resolve(null);
    });
  });
  return spotifyApiPromise;
}