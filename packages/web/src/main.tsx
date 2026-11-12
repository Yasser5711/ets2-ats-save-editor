import { createRoot } from "react-dom/client";
import { App } from "@/App.tsx";
import { installDesktopBridge } from "@/lib/desktop.ts";
import { I18nProvider } from "@/lib/i18n.tsx";
import "./index.css";

document.documentElement.classList.add("dark");

await installDesktopBridge();
createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <App />
  </I18nProvider>,
);
