import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  plugins: [react()],
  // Relative base so the built index.html resolves assets inside the Tauri webview
  base: "./",
  define: {
    // App version injected at build time (used by About / update checker).
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: "dist",
    target: "chrome128",
    chunkSizeWarningLimit: 1500,
    // Don't wipe the output dir: a stray electron-builder artifact may lock it.
    emptyOutDir: false,
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    watch: {
      // 排除 Tauri 构建目录，避免文件锁定
      ignored: [
        "**/src-tauri/**",
        // 外部工具原子写入源码时的瞬态路径（先建 .name.pid.uuid.tmpdir/
        // xxx.tmp 再改名替换）。chokidar 若对它们建立 fs.watch，Windows 上
        // 会因文件同时被改名/删除抛 EBUSY 且未捕获，导致 dev server 崩溃。
        "**/.*.tmpdir",
        "**/.*.tmpdir/**",
        "**/*.tmp",
      ],
    },
  },
});
