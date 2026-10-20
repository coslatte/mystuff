import { DEFAULT_SETTINGS, sanitize, type PigmentSettings } from "../lib/graphics/pigment-settings";
import { readJson, writeJson } from "./storage";

const STORAGE_KEY = "cosmiclatte.spectral.settings";

/** Restores the last session, falling back to the defaults. */
export function restoreSettings(): PigmentSettings {
  return sanitize(DEFAULT_SETTINGS, readJson<Record<string, unknown>>(STORAGE_KEY, {}));
}

export function rememberSettings(settings: PigmentSettings): void {
  writeJson(STORAGE_KEY, settings);
}
