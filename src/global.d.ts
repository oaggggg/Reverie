/// <reference types="vite/client" />

/** Native bridge implemented by the Tauri adapter. */
interface NcmBridge {
  apiBase: string;
  platform: string;
  /** True in development builds, where signed updater artifacts do not exist. */
  skipUpdate: boolean;
  versions: {
    runtime: string;
    webview: string;
  };
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximized: (callback: (maximized: boolean) => void) => () => void;
  /** Trigger an update check through the Tauri updater plugin. */
  checkUpdate: (manual?: boolean) => Promise<{ ok: boolean; reason?: string }>;
  /** Start downloading the available update (after user confirms). */
  downloadUpdate: () => Promise<{ ok: boolean; reason?: string }>;
  /** Quit the app and install the downloaded update. */
  installUpdate: () => Promise<void>;
  /** Subscribe to updater events pushed from the main process. */
  onUpdateEvent: (
    callback: (event: {
      type:
        | "checking"
        | "available"
        | "not-available"
        | "progress"
        | "downloaded"
        | "installing"
        | "error";
      data?: {
        version?: string;
        notes?: string;
        manual?: boolean;
        percent?: number;
        transferred?: number;
        total?: number;
        speed?: number;
        stage?: "check" | "download" | "install";
        message?: string;
      };
    }) => void,
  ) => () => void;
}

declare global {
  interface Window {
    ncm?: NcmBridge;
  }
  /** App version injected by Vite (see vite.config.ts). */
  const __APP_VERSION__: string;
}

export {};
