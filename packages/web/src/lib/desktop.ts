import type { Settings } from "./platform.ts";

export interface DesktopBridge {
  apiPort: () => Promise<number>;
  readSettings: () => Promise<Settings>;
  writeSettings: (settings: Settings) => Promise<void>;
  pickFolder: (title: string) => Promise<string | null>;
}

export const runningInTauri = () =>
  Boolean((globalThis as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

/**
 * Plugin APIs are not exposed on the global `__TAURI__` object, so the real
 * packages are imported instead - only inside Tauri, to keep the browser bundle
 * free of IPC code.
 */
export async function installDesktopBridge(): Promise<void> {
  if (!runningInTauri()) return;
  const [{ invoke }, { open }] = await Promise.all([
    import("@tauri-apps/api/core"),
    import("@tauri-apps/plugin-dialog"),
  ]);
  const bridge: DesktopBridge = {
    apiPort: () => invoke<number>("api_port"),
    readSettings: () => invoke<Settings>("read_settings"),
    writeSettings: (settings) => invoke("write_settings", { settings }),
    pickFolder: async (title) => {
      const picked = await open({ directory: true, multiple: false, title });
      return typeof picked === "string" ? picked : null;
    },
  };
  Object.assign(globalThis, { truckDesktop: bridge });
}
