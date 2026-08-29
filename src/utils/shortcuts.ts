/**
 * 播放器键盘快捷键：动作定义、组合键归一化与展示格式化。
 * 组合键以 KeyboardEvent.code 为基准（布局无关），修饰键按
 * Ctrl / Alt / Shift / Meta 顺序归一，形如 "Ctrl+ArrowLeft"。
 */

export type ShortcutActionId =
  | "togglePlay"
  | "prev"
  | "next"
  | "seekFwd"
  | "seekBack"
  | "volUp"
  | "volDown"
  | "toggleMute"
  | "toggleLike"
  | "cyclePlayMode";

export interface ShortcutAction {
  id: ShortcutActionId;
  label: string;
  combo: string;
}

export const PLAYER_SHORTCUT_ACTIONS: ShortcutAction[] = [
  { id: "togglePlay", label: "播放 / 暂停", combo: "Space" },
  { id: "prev", label: "上一首", combo: "Ctrl+ArrowLeft" },
  { id: "next", label: "下一首", combo: "Ctrl+ArrowRight" },
  { id: "seekBack", label: "快退 5 秒", combo: "ArrowLeft" },
  { id: "seekFwd", label: "快进 5 秒", combo: "ArrowRight" },
  { id: "volDown", label: "减小音量", combo: "ArrowDown" },
  { id: "volUp", label: "增大音量", combo: "ArrowUp" },
  { id: "toggleMute", label: "静音 / 取消静音", combo: "KeyM" },
  { id: "toggleLike", label: "喜欢 / 取消喜欢当前歌曲", combo: "KeyL" },
  { id: "cyclePlayMode", label: "切换播放模式", combo: "KeyP" },
];

/** 固定快捷键（不可自定义，仅用于设置面板展示）。 */
export const FIXED_SHORTCUTS: Array<{ label: string; combo: string[] }> = [
  { label: "打开搜索", combo: ["Ctrl", "F"] },
  { label: "打开设置", combo: ["Ctrl", ","] },
];

const MODIFIER_ONLY = /^(Control|Alt|Shift|Meta)(Left|Right)?$/;

/** 从键盘事件归一化出组合键；纯修饰键返回 null。 */
export function comboFromEvent(e: KeyboardEvent): string | null {
  const code = e.code;
  if (!code || MODIFIER_ONLY.test(code)) return null;
  const keys: string[] = [];
  if (e.ctrlKey) keys.push("Ctrl");
  if (e.altKey) keys.push("Alt");
  if (e.shiftKey) keys.push("Shift");
  if (e.metaKey) keys.push("Meta");
  keys.push(code);
  return keys.join("+");
}

const KEY_LABELS: Record<string, string> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Escape: "Esc",
  Backspace: "⌫",
  Delete: "Del",
  PageUp: "PgUp",
  PageDown: "PgDn",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Semicolon: ";",
  Quote: "'",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Minus: "-",
  Equal: "=",
  Backquote: "`",
};

function formatKey(token: string): string {
  if (
    token === "Ctrl" ||
    token === "Alt" ||
    token === "Shift" ||
    token === "Meta"
  )
    return token;
  return KEY_LABELS[token] ?? token.replace(/^Key|^Digit/, "");
}

/** 组合键展示为按键序列，例如 "Ctrl+ArrowLeft" → ["Ctrl", "←"]。 */
export function formatCombo(combo: string): string[] {
  return combo.split("+").map(formatKey);
}

/** 按当前覆盖表解析组合键对应的动作；未命中返回 null。 */
export function resolveShortcutAction(
  overrides: Record<string, string>,
  combo: string,
): ShortcutActionId | null {
  for (const action of PLAYER_SHORTCUT_ACTIONS) {
    if ((overrides[action.id] ?? action.combo) === combo) return action.id;
  }
  return null;
}

/** 组合键是否已被其他动作占用（用于自定义录入时的冲突校验）。 */
export function findShortcutConflict(
  overrides: Record<string, string>,
  actionId: ShortcutActionId,
  combo: string,
): ShortcutAction | null {
  return (
    PLAYER_SHORTCUT_ACTIONS.find(
      (action) =>
        action.id !== actionId &&
        (overrides[action.id] ?? action.combo) === combo,
    ) ?? null
  );
}
