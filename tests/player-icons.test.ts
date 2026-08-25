import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 播放器界面（播放栏 / 正在播放 / DIY 面板 / 评论抽屉）的图标约束：
 * 1. 每个图标都必须真实存在于 lucide-react 包中；
 * 2. 播放器界面内不允许任何两个文件使用同一个图标 —— “全部焕新，不要有重复”。
 *    新增界面图标时同步更新对应文件的导入；引入重复会让本测试失败。
 */
const PLAYER_SURFACE_FILES = [
  "src/components/PlayerBar.tsx",
  "src/components/NowPlayingView.tsx",
  "src/components/PlaybackVisualPanel.tsx",
  "src/components/PlayerCommentsDrawer.tsx",
];

const ROOT = join(import.meta.dirname, "..");
const LUCIDE_ICONS_DIR = join(
  ROOT,
  "node_modules",
  "lucide-react",
  "dist",
  "esm",
  "icons",
);

function pascalToKebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-zA-Z])(\d)/g, "$1-$2")
    .toLowerCase();
}

function extractIconNames(source: string): string[] {
  const match = source.match(
    /import\s*\{([^}]+)\}\s*from\s*["']lucide-react["']/,
  );
  if (!match) return [];
  return match[1]
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

test("player surface icons exist in lucide-react", () => {
  for (const file of PLAYER_SURFACE_FILES) {
    const source = readFileSync(join(ROOT, file), "utf8");
    for (const name of extractIconNames(source)) {
      const kebab = pascalToKebab(name);
      assert.ok(
        existsSync(join(LUCIDE_ICONS_DIR, `${kebab}.mjs`)),
        `${file} 引用的图标 ${name} (${kebab}) 不存在于 lucide-react`,
      );
    }
  }
});

test("player surface icons are pairwise unique across files", () => {
  const owner = new Map<string, string>();
  for (const file of PLAYER_SURFACE_FILES) {
    const source = readFileSync(join(ROOT, file), "utf8");
    for (const name of extractIconNames(source)) {
      const previous = owner.get(name);
      assert.ok(
        !previous,
        `图标 ${name} 同时被 ${previous} 与 ${file} 使用：播放器界面要求图标不重复`,
      );
      owner.set(name, file);
    }
  }
});

test("player bar keeps a distinct icon per playback function", () => {
  // 关键功能图标必须各不相同且存在，防止未来回退成“万能占位”。
  const source = readFileSync(
    join(ROOT, "src/components/PlayerBar.tsx"),
    "utf8",
  );
  const names = new Set(extractIconNames(source));
  for (const required of [
    "Play",
    "Pause",
    "SkipBack",
    "SkipForward",
    "Shuffle",
    "Repeat",
    "Repeat1",
    "Heart",
    "Turntable",
    "RadioTower",
    "ListMusic",
    "MessageCircleMore",
    "Share",
    "Volume2",
    "VolumeX",
  ]) {
    assert.ok(names.has(required), `PlayerBar 缺少功能图标 ${required}`);
  }
});
