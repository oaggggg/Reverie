import type { LyricLine } from "../api/types.ts";

const TIME_TAG = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

interface RawLine {
  time: number;
  text: string;
}

function parsePlain(lrc: string): RawLine[] {
  const lines: RawLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const times: number[] = [];
    TIME_TAG.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TIME_TAG.exec(raw))) {
      const mm = Number(m[1]);
      const ss = Number(m[2]);
      const frac = String(m[3] ?? "0")
        .padEnd(3, "0")
        .slice(0, 3);
      times.push(mm * 60000 + ss * 1000 + Number(frac));
    }
    const text = raw.replace(TIME_TAG, "").replace(/^\s+|\s+$/g, "");
    if (!times.length) continue;
    for (const t of times) lines.push({ time: t, text });
  }
  lines.sort((a, b) => a.time - b.time);
  return lines;
}

/**
 * Parse LRC + optional translation (TLyric) into a merged lyric line list.
 * Translation lines are matched to original lines by timestamp.
 */
export function parseLyrics(lrc: string, tlyric = ""): LyricLine[] {
  const originals = parsePlain(lrc);
  const translations = parsePlain(tlyric);

  // Build a lookup for translations by exact timestamp (first wins).
  const transByTime = new Map<number, string>();
  for (const t of translations) {
    if (!transByTime.has(t.time)) transByTime.set(t.time, t.text);
  }

  // Deduplicate original timestamps (keep the first text per timestamp).
  const seen = new Map<number, LyricLine>();
  for (const o of originals) {
    if (seen.has(o.time)) continue;
    const line: LyricLine = { time: o.time, text: o.text };
    const tr = transByTime.get(o.time);
    if (tr && tr !== o.text) line.translation = tr;
    seen.set(o.time, line);
  }

  const result = Array.from(seen.values()).sort((a, b) => a.time - b.time);

  // If no lyrics at all, synthesize a single placeholder.
  if (!result.length) {
    return [{ time: 0, text: "纯音乐，请欣赏" }];
  }

  return result;
}

/** Format milliseconds as m:ss or h:mm:ss. */
export function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/* ------------------------------------------------------------------ */
/*  Lyric quote (for the home header)                                  */
/* ------------------------------------------------------------------ */

const METADATA_RE =
  /作词|作曲|编曲|制作人|制作|录音|混音|母带|监制|和声|配唱|键盘|吉他|贝斯|鼓|弦乐|编写|编程|op\s*[:：]|sp\s*[:：]|企划|统筹|发行|封面|摄影|设计|文案|出品|版权|词曲|未经许可|纯音乐|间奏|伴奏|人声|录制|缩混|master|producer|arrang|compose|编曲人|词曲人/i;

/** Lines that reveal a duet role or person-name prefix (e.g. "女：…", "周杰伦：…"). */
const NONLYRIC_RE =
  /^[（(](男|女|合|独|齐|对白|旁白|说唱)[）)]|[:：]\s*(女|男|合|独|对白|旁白|说唱|合唱)|^[\u4e00-\u9fa5]{1,6}[:：]/i;

/** 合唱/署名前缀："李硕、达布希勒图、张鑫：…" 这类多名单（顿号/逗号/空格相连）
 *  后跟冒号的行 —— 实测会从 Live 版歌词里漏进首页文案。 */
const DUET_NAME_PREFIX_RE =
  /^[A-Za-z0-9\u4e00-\u9fa5·]{1,16}(?:[、,，\s]+[A-Za-z0-9\u4e00-\u9fa5·]{1,16}){0,5}[:：]\s*\S/;

/** 社交提及/站外引导："@IceTeeth"、"关注公众号" 一类非歌词行。 */
const MENTION_RE = /@[A-Za-z0-9_\u4e00-\u9fa5]|关注(我们|公众号|订阅)|点赞|转发/;

/** 逐字歌词 JSON 时间轴碎片：网易云把 YRC 数据（{"t":1000,"c":[…]}）塞进
 *  lrc 字段，剥掉时间标签后会残留 `{"t":1000,"c":}` 一类片段 —— 真实歌词
 *  正文不会包含花括号或 JSON 键值对。 */
const JSON_TIMELINE_RE = /[{}]|"\w+"\s*[:：]/;

/** 无信息量的语气词：纯拉丁行若全部由它们构成则不作为首页文案。 */
const VOCABLES = new Set([
  "yeah", "yea", "oh", "ooh", "oooh", "ooooh", "ohh", "woow", "woo",
  "wooo", "wu", "ha", "la", "na", "hey", "ho", "uh", "um", "ah", "ahh",
  "hmm", "mm", "oo", "hoo",
]);

/** 语气词判定允许常见的拖长变体（yeahhh / ohhh / laaa…）。 */
function isVocable(word: string): boolean {
  if (VOCABLES.has(word)) return true;
  const stem = word.replace(/([a-z])\1{1,}$/, "$1");
  return VOCABLES.has(stem) || (stem.length >= 2 && VOCABLES.has(stem + "h"));
}

/**
 * Whether a lyric line is a real lyric (not metadata/credit/empty).
 */
export function isLyricLine(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.length < 4) return false;
  if (JSON_TIMELINE_RE.test(t)) return false;
  if (METADATA_RE.test(t)) return false;
  if (NONLYRIC_RE.test(t)) return false;
  // 多人名连排 + 冒号（Live 版合唱标注）
  if (DUET_NAME_PREFIX_RE.test(t)) return false;
  if (MENTION_RE.test(t)) return false;
  // 剥掉括号舞台指示后再判断语气词堆砌
  const stripped = t.replace(/[（(][^（）()]*[）)]/g, " ").trim();
  if (!stripped) return false;
  if (!/[\u4e00-\u9fa5]/.test(stripped)) {
    const words = stripped.toLowerCase().split(/[^a-z]+/).filter(Boolean);
    if (words.length > 0 && words.every(isVocable)) return false;
  }
  // 行尾孤立的中转英截断残片（如 "brand new的stu"）——真实歌词极少这样收尾
  if (/[\u4e00-\u9fa5]["')）]?\s*[A-Za-z]{2,4}$/.test(stripped)) return false;
  return true;
}

/**
 * Pick a random meaningful lyric line from raw LRC.
 *
 * 显示异常的两个来源在此处理：
 * 1) 行内中英混排——很多 LRC 把译文拼在同一行（“中文 / english”），直接
 *    展示会显得破碎，这里剥掉纯拉丁的尾部只留原文；
 * 2) 候选池里只有英文填充行——优先返回含中文的行，避免首页文案变成
 *    无信息量的英文残句。
 */
const INLINE_TRANSLATION_SPLIT_RE = /\s*(?:\/\/|[/／|｜])\s*/;

function stripInlineTranslation(text: string): string {
  const parts = text
    .split(INLINE_TRANSLATION_SPLIT_RE)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return text;
  const tailIsTranslation = parts
    .slice(1)
    .every((part) => !/[\u4e00-\u9fa5]/.test(part));
  return tailIsTranslation ? parts[0] : text;
}

export function pickRandomLyricLine(lrc: string): string | null {
  const cjkLines: string[] = [];
  const latinLines: string[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const stripped = stripInlineTranslation(
      raw.replace(/\[[^\]]*\]/g, "").trim(),
    );
    if (!isLyricLine(stripped) || stripped.length > 60) continue;
    // 中文行允许 4 字短句（“爱你一万年”这类完整短句是优质文案）；
    // 纯拉丁行要求更长，避免英文填充词残句混入。
    const isCjk = /[\u4e00-\u9fa5]/.test(stripped);
    if (stripped.length < (isCjk ? 4 : 8)) continue;
    if (isCjk) cjkLines.push(stripped);
    else latinLines.push(stripped);
  }
  const lines = cjkLines.length ? cjkLines : latinLines;
  if (!lines.length) return null;
  return lines[Math.floor(Math.random() * lines.length)];
}
