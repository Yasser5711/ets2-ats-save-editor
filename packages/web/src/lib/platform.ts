import type { DesktopBridge } from "./desktop.ts";

export interface Settings {
  root: string | null;
  gameId: string | null;
}

const STORAGE_KEY = "truck-save-editor.settings";

function bridge(): DesktopBridge | null {
  return (globalThis as { truckDesktop?: DesktopBridge }).truckDesktop ?? null;
}

export const isDesktop = () => bridge() !== null;

let apiBase = "";

export async function initPlatform(): Promise<void> {
  const desktop = bridge();
  if (!desktop) return;
  apiBase = `http://127.0.0.1:${await desktop.apiPort()}`;
}

export const api = (path: string) => `${apiBase}${path}`;

export async function pickFolder(title = "Select the game folder"): Promise<string | null> {
  const desktop = bridge();
  if (desktop) return desktop.pickFolder(title);
  const typed = globalThis.prompt(`${title}\n\nPaste the full path:`);
  return typed === null || typed.trim() === "" ? null : typed.trim();
}

export async function loadSettings(): Promise<Settings> {
  const desktop = bridge();
  if (desktop) return desktop.readSettings();
  const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
  if (!raw) return { root: null, gameId: null };
  try {
    return JSON.parse(raw) as Settings;
  } catch {
    return { root: null, gameId: null };
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const desktop = bridge();
  if (desktop) {
    await desktop.writeSettings(settings);
    return;
  }
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(settings));
}
