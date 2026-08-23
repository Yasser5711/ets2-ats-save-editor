interface TauriBridge {
  pickFolder: (title: string) => Promise<string | null>;
  apiPort: () => Promise<number>;
  readSettings: () => Promise<Settings>;
  writeSettings: (settings: Settings) => Promise<void>;
}

export interface Settings {
  root: string | null;
  gameId: string | null;
}

const STORAGE_KEY = "truck-save-editor.settings";

function bridge(): TauriBridge | null {
  const candidate = (globalThis as { truckDesktop?: TauriBridge }).truckDesktop;
  return candidate ?? null;
}

export const isDesktop = () => bridge() !== null;

let apiBase = "";

export async function initPlatform(): Promise<void> {
  const desktop = bridge();
  if (!desktop) return;
  const port = await desktop.apiPort();
  apiBase = `http://127.0.0.1:${port}`;
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
