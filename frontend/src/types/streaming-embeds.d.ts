/*
 * Both platform scripts are untyped globals loaded at runtime, so these are the
 * only members the embed service is allowed to reach for. Widening them later
 * means widening this file, not sprinkling `any`.
 */

export {};

declare global {
  type SoundCloudSound = {
    id?: number;
    title?: string;
    duration?: number;
    user?: { username?: string };
  };

  type SoundCloudWidgetApi = {
    play: () => void;
    pause: () => void;
    toggle: () => void;
    getCurrentSound: (callback: (sound: SoundCloudSound) => void) => void;
    bind: (event: string, handler: () => void) => void;
  };

  type SpotifyEmbedController = {
    togglePlay: () => void;
    pause: () => void;
    destroy: () => void;
    addListener: (
      event: string,
      handler: (payload: { data?: Record<string, unknown> }) => void
    ) => void;
  };

  type SpotifyIFrameApi = {
    createController: (
      element: HTMLElement,
      options: { uri?: string; url?: string; width?: number; height?: number },
      callback: (controller: SpotifyEmbedController) => void
    ) => void;
  };

  interface Window {
    SC?: {
      /** Carries the event-name constants on `SC.Widget.Events`. */
      Widget: ((iframe: HTMLIFrameElement) => SoundCloudWidgetApi) & {
        Events: { PLAY: string; PAUSE: string; FINISH: string };
      };
    };
    onSpotifyIframeApiReady?: (api: SpotifyIFrameApi) => void;
  }
}