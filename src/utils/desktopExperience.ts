const root = document.documentElement;

function updateWindowState() {
  root.dataset.windowActive =
    document.visibilityState === "visible"
      ? "true"
      : "false";
}

function setInputMode(mode: "keyboard" | "pointer") {
  root.dataset.inputMode = mode;
}

export function installDesktopExperience() {
  root.dataset.platform = window.ncm?.platform ?? "unknown";
  updateWindowState();

  window.addEventListener("focus", updateWindowState);
  window.addEventListener("blur", updateWindowState);
  document.addEventListener("visibilitychange", updateWindowState);
  document.addEventListener("keydown", () => setInputMode("keyboard"), true);
  document.addEventListener("pointerdown", () => setInputMode("pointer"), true);
}
