import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import App from "./App";
import "./index.css";
import "./tauri-api"; // 初始化 Tauri API
import { installDesktopExperience } from "./utils/desktopExperience";

installDesktopExperience();

const root = createRoot(document.getElementById("root")!);
flushSync(() => root.render(<App />));
