import { createRoot } from "react-dom/client";
import { App } from "@/App.tsx";
import { installDesktopBridge } from "@/lib/desktop.ts";
import "./index.css";

installDesktopBridge();
document.documentElement.classList.add("dark");
createRoot(document.getElementById("root")!).render(<App />);
