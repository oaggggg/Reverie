import { getCurrentWindow } from "@tauri-apps/api/window";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

type NativeBridge = NonNullable<Window["ncm"]>;
type UpdateEvent = Parameters<NativeBridge["onUpdateEvent"]>[0] extends (
  event: infer T,
) => void
  ? T
  : never;

const hasTauriRuntime =
  (window as unknown as { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__ !== undefined;
const appWindow = hasTauriRuntime ? getCurrentWindow() : null;
const updateListeners = new Set<(event: UpdateEvent) => void>();
let pendingUpdate: Update | null = null;
let checking = false;
let downloading = false;
let installing = false;
let downloaded = false;
let lastCheckAt = 0;
let lastFailedCheckAt = 0;

const CHECK_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 20 * 60_000;
const AUTO_CHECK_COOLDOWN_MS = 30 * 60_000;
const FAILED_CHECK_COOLDOWN_MS = 5 * 60_000;

function emit(event: UpdateEvent) {
  for (const listener of updateListeners) {
    try {
      listener(event);
    } catch {
      // A stale UI listener must never interrupt an updater operation.
    }
  }
}

function webviewVersion(): string {
  return navigator.userAgent.match(/(?:Edg|Chrome)\/(\S+)/)?.[1] ?? "unknown";
}

export const ncm: NativeBridge = {
  apiBase: "http://127.0.0.1:3939",
  platform: navigator.platform.toLowerCase().includes("win")
    ? "win32"
    : navigator.platform.toLowerCase().includes("mac")
      ? "darwin"
      : "linux",
  skipUpdate: import.meta.env.DEV,
  versions: {
    runtime: "Tauri 2",
    webview: webviewVersion(),
  },

  minimize: () => appWindow?.minimize(),
  maximize: async () => {
    if (!appWindow) return;
    if (await appWindow.isMaximized()) await appWindow.unmaximize();
    else await appWindow.maximize();
  },
  close: () => appWindow?.close(),
  isMaximized: () => appWindow?.isMaximized() ?? Promise.resolve(false),
  onMaximized: (callback) => {
    if (!appWindow) return () => {};
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void appWindow
      .onResized(async () => callback(await appWindow.isMaximized()))
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  },

  checkUpdate: async (manual = false) => {
    if (import.meta.env.DEV) return { ok: false, reason: "development" };
    if (checking || downloading || installing)
      return { ok: false, reason: "busy" };
    if (downloaded) return { ok: false, reason: "downloaded" };

    const now = Date.now();
    if (!manual && now - lastCheckAt < AUTO_CHECK_COOLDOWN_MS) {
      return { ok: false, reason: "throttled" };
    }
    if (!manual && now - lastFailedCheckAt < FAILED_CHECK_COOLDOWN_MS) {
      return { ok: false, reason: "throttled" };
    }

    checking = true;
    lastCheckAt = now;
    emit({ type: "checking", data: { manual } });
    try {
      await pendingUpdate?.close();
      pendingUpdate = null;
      pendingUpdate = await check({ timeout: CHECK_TIMEOUT_MS });
      if (!pendingUpdate) {
        emit({ type: "not-available", data: { manual } });
        return { ok: true };
      }
      emit({
        type: "available",
        data: {
          version: pendingUpdate.version,
          notes: pendingUpdate.body ?? "",
          manual,
        },
      });
      return { ok: true };
    } catch (error) {
      lastFailedCheckAt = Date.now();
      emit({
        type: "error",
        data: { manual, stage: "check", message: String(error) },
      });
      return { ok: false, reason: "check-failed" };
    } finally {
      checking = false;
    }
  },

  downloadUpdate: async () => {
    if (!pendingUpdate) return { ok: false, reason: "no-update" };
    if (downloading || installing) return { ok: false, reason: "busy" };
    if (downloaded) return { ok: false, reason: "downloaded" };

    downloading = true;
    let transferred = 0;
    let total = 0;
    let lastBytes = 0;
    let lastTime = performance.now();
    try {
      await pendingUpdate.download(
        (event) => {
          if (event.event === "Started") {
            total = event.data.contentLength ?? 0;
            emit({
              type: "progress",
              data: { percent: 0, transferred: 0, total, speed: 0 },
            });
            return;
          }
          if (event.event === "Finished") {
            emit({
              type: "progress",
              data: {
                percent: 100,
                transferred: total || transferred,
                total,
                speed: 0,
              },
            });
            return;
          }
          if (event.event !== "Progress") return;

          transferred += event.data.chunkLength;
          const now = performance.now();
          const elapsed = Math.max(1, now - lastTime);
          const speed = ((transferred - lastBytes) * 1000) / elapsed;
          lastBytes = transferred;
          lastTime = now;
          emit({
            type: "progress",
            data: {
              percent: total
                ? Math.min(100, Math.round((transferred / total) * 100))
                : 0,
              transferred,
              total,
              speed,
            },
          });
        },
        { timeout: DOWNLOAD_TIMEOUT_MS },
      );
      downloaded = true;
      emit({ type: "downloaded", data: { version: pendingUpdate.version } });
      return { ok: true };
    } catch (error) {
      emit({
        type: "error",
        data: {
          stage: "download",
          version: pendingUpdate.version,
          message: String(error),
        },
      });
      return { ok: false, reason: "download-failed" };
    } finally {
      downloading = false;
    }
  },

  installUpdate: async () => {
    if (!pendingUpdate || !downloaded || installing) return;
    installing = true;
    emit({
      type: "installing",
      data: { version: pendingUpdate.version },
    });
    try {
      await pendingUpdate.install();
      // On Windows the updater launches the installer and exits the app. A
      // second relaunch races the installer and can reopen the old binary.
      if (!navigator.platform.toLowerCase().includes("win")) await relaunch();
    } catch (error) {
      installing = false;
      emit({
        type: "error",
        data: {
          stage: "install",
          version: pendingUpdate.version,
          message: String(error),
        },
      });
    }
  },
  onUpdateEvent: (callback) => {
    updateListeners.add(callback);
    return () => updateListeners.delete(callback);
  },
};

window.ncm = ncm;
