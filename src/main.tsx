import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import App from "./App";
import "./index.css";
import "./tauri-api"; // 初始化 Tauri API
import { installDesktopExperience } from "./utils/desktopExperience";

function readPreference(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function initializeVisualPreferences() {
  const root = document.documentElement;
  const theme = readPreference("reverie_theme", "system");
  const effectiveTheme =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme === "dark"
        ? "dark"
        : "light";
  const glassOpacity = readPreference("reverie_glass_opacity", "balanced");
  const glassBlur = readPreference("reverie_glass_blur", "strong");
  const glassContrast = readPreference("reverie_glass_contrast", "standard");
  const animationSpeed = readPreference("reverie_animation_speed", "normal");
  const reducedMotion = readPreference("reverie_reduced_motion", "0");

  root.setAttribute("data-theme", effectiveTheme);
  root.setAttribute("data-glass-opacity", glassOpacity);
  root.setAttribute("data-glass-blur", glassBlur);
  root.setAttribute("data-glass-contrast", glassContrast);
  root.setAttribute("data-animation-speed", animationSpeed);
  root.setAttribute("data-reduced-motion", reducedMotion === "1" ? "true" : "false");
}

initializeVisualPreferences();
installDesktopExperience();

const root = createRoot(document.getElementById("root")!);
flushSync(() => root.render(<App />));
