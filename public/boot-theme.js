// Apply persisted theme before React mounts to avoid a flash of the wrong theme.
try {
  var t = localStorage.getItem("reverie_theme") || "system";
  var d =
    t === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : t === "light"
        ? "light"
        : "dark";
  document.documentElement.setAttribute("data-theme", d);
} catch (e) {}
