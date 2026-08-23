import type { Settings } from "./platform.ts";

interface TauriGlobal {
  core: { invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T> };
  dialog?: { open: (options: Record<string, unknown>) => Promise<string | string[] | null> };
}

function tauri(): TauriGlobal | null {
  const global = globalThis as { __TAURI__?: TauriGlobal; __TAURI_INTERNALS__?: unknown };
  if (!global.__TAURI_INTERNALS__) return null;
  return global.__TAURI__ ?? null;
}

export function installDesktopBridge(): void {
  const runtime = tauri();
  if (!runtime) return;
  const invoke = runtime.core.invoke;
  Object.assign(globalThis, {
    truckDesktop: {
      apiPort: () => invoke<number>("api_port"),
      readSettings: () => invoke<Settings>("read_settings"),
      writeSettings: (settings: Settings) => invoke<void>("write_settings", { settings }),
      pickFolder: async (title: string) => {
        const picked = await runtime.dialog?.open({ directory: true, multiple: false, title });
        return typeof picked === "string" ? picked : null;
      },
    },
  });
}
