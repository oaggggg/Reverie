export type DiagnosticLevel = "info" | "warn" | "error";

export interface DiagnosticEntry {
  at: string;
  level: DiagnosticLevel;
  message: string;
}

const MAX_ENTRIES = 240;
const entries: DiagnosticEntry[] = [];
let installed = false;
let originalWarn: typeof console.warn | null = null;
let originalError: typeof console.error | null = null;

function sanitize(value: unknown): string {
  const text =
    value instanceof Error ? value.stack || value.message : String(value);
  return text
    .replace(
      /(cookie|authorization|token|password|passwd|secret)=([^\s&]+)/gi,
      "$1=[redacted]",
    )
    .replace(
      /(cookie|authorization|token|password|passwd|secret)\s*:\s*([^\s,]+)/gi,
      "$1: [redacted]",
    )
    .replace(/https?:\/\/[^\s]+/gi, (url) =>
      url.replace(
        /([?&](?:cookie|token|password|secret|auth)=[^&\s]*)/gi,
        "[redacted]",
      ),
    );
}

export function recordDiagnostic(
  level: DiagnosticLevel,
  message: unknown,
): void {
  entries.push({
    at: new Date().toISOString(),
    level,
    message: sanitize(message).slice(0, 1600),
  });
  if (entries.length > MAX_ENTRIES)
    entries.splice(0, entries.length - MAX_ENTRIES);
}

export function getDiagnosticEntries(): DiagnosticEntry[] {
  return entries.map((entry) => ({ ...entry }));
}

export function installDiagnostics(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    const location = event.filename
      ? ` (${event.filename}:${event.lineno}:${event.colno})`
      : "";
    recordDiagnostic(
      "error",
      `${event.message}${location}\n${event.error?.stack || ""}`,
    );
  });
  window.addEventListener("unhandledrejection", (event) => {
    recordDiagnostic("error", `Unhandled promise rejection: ${event.reason}`);
  });

  originalWarn = console.warn.bind(console);
  originalError = console.error.bind(console);
  console.warn = (...args) => {
    recordDiagnostic("warn", args.map(sanitize).join(" "));
    originalWarn?.(...args);
  };
  console.error = (...args) => {
    recordDiagnostic("error", args.map(sanitize).join(" "));
    originalError?.(...args);
  };
}

export interface FeedbackContext {
  platform: string;
  runtime: string;
  webview: string;
  currentSong?: string;
}

export function createFeedbackIssue(
  description: string,
  context: FeedbackContext,
): { title: string; body: string } {
  const report = getDiagnosticEntries();
  const errors = report.filter((entry) => entry.level === "error");
  const titleError = errors[0]?.message.replace(/\s+/g, " ").slice(0, 72);
  const title = `[反馈] ${titleError || "播放器问题"}`;
  const storageKeys =
    typeof localStorage === "undefined"
      ? []
      : Object.keys(localStorage).filter(
          (key) => !/cookie|token|password|secret/i.test(key),
        );
  const logText = report.length
    ? report
        .map(
          (entry) =>
            `[${entry.at}] [${entry.level.toUpperCase()}] ${entry.message}`,
        )
        .join("\n")
    : "暂无运行时日志。";

  const body = [
    "## 问题描述",
    sanitize(description).trim() || "（未填写，请在此补充问题描述）",
    "",
    "## 错误标记",
    errors.length
      ? `检测到 ${errors.length} 条错误记录。`
      : "未检测到未捕获错误，请根据现象排查。",
    "",
    "## 运行环境",
    `- 应用版本：v${__APP_VERSION__}`,
    `- 平台：${context.platform}`,
    `- 运行时：${context.runtime}`,
    `- WebView：${context.webview}`,
    `- 当前歌曲：${context.currentSong || "无"}`,
    `- User Agent：${sanitize(navigator.userAgent)}`,
    `- 本地设置键：${storageKeys.join(", ") || "无"}`,
    "",
    "## 完整诊断日志",
    "```text",
    logText,
    "```",
    "",
    "> 此报告由 Reverie 自动生成，敏感字段已脱敏。",
  ].join("\n");

  return { title, body };
}

export function buildGitHubIssueUrl(issue: {
  title: string;
  body: string;
}): string {
  const params = new URLSearchParams({ title: issue.title, body: issue.body });
  return `https://github.com/oaggggg/Reverie/issues/new?${params.toString()}`;
}

export async function openGitHubIssue(url: string): Promise<void> {
  const hasTauri = Boolean(
    (window as unknown as { __TAURI_INTERNALS__?: unknown })
      .__TAURI_INTERNALS__,
  );
  if (hasTauri) {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
