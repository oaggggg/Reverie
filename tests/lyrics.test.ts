import assert from "node:assert/strict";
import test from "node:test";
import {
  formatTime,
  isLyricLine,
  parseLyrics,
  pickRandomLyricLine,
} from "../src/utils/lyrics.ts";

test("parseLyrics merges translations and removes duplicate timestamps", () => {
  const lines = parseLyrics(
    "[00:01.00]第一行\n[00:01.00]重复行\n[00:02.50]第二行",
    "[00:01.00]First line\n[00:02.50]第二行",
  );

  assert.deepEqual(lines, [
    { time: 1000, text: "第一行", translation: "First line" },
    { time: 2500, text: "第二行" },
  ]);
});

test("parseLyrics handles multiple timestamps and empty lyrics", () => {
  assert.deepEqual(parseLyrics("[00:01][00:03]回声"), [
    { time: 1000, text: "回声" },
    { time: 3000, text: "回声" },
  ]);
  assert.deepEqual(parseLyrics(""), [{ time: 0, text: "纯音乐，请欣赏" }]);
});

test("formatTime clamps invalid values and supports hours", () => {
  assert.equal(formatTime(-1), "0:00");
  assert.equal(formatTime(Number.NaN), "0:00");
  assert.equal(formatTime(3_661_000), "1:01:01");
});

test("lyric quote helpers reject credits and retain meaningful lines", () => {
  assert.equal(isLyricLine("作词：某某"), false);
  assert.equal(isLyricLine("女：这一段是对白"), false);
  assert.equal(isLyricLine("风吹过安静的街道"), true);
  assert.equal(
    pickRandomLyricLine("[00:01]作曲：某某\n[00:02]风吹过安静的街道"),
    "风吹过安静的街道",
  );
});

test("lyric quote rejects multi-singer credit prefixes from live recordings", () => {
  // Live 版歌词里实测泄漏的三人合唱行
  assert.equal(isLyricLine("李硕、达布希勒图、张鑫：你要离开"), false);
  assert.equal(isLyricLine("周杰伦：看着你"), false);
  assert.equal(isLyricLine("Taylor Jay: standing here"), false);
});

test("lyric quote rejects mentions, vocable spam and truncated fragments", () => {
  assert.equal(isLyricLine("@IceTeeth"), false);
  assert.equal(isLyricLine("关注公众号看更多幕后"), false);
  assert.equal(isLyricLine("Yeah yeah yeah yeah yeah"), false);
  assert.equal(isLyricLine("Oooh yeah（疯狂地生长）"), false);
  // 中转英截断残句
  assert.equal(isLyricLine("brand new的stu"), false);
  // 正常歌词不受影响
  assert.equal(isLyricLine("可会变 (谁没在变)"), true);
  assert.equal(isLyricLine("原谅我这一生不羁放纵爱自由"), true);
});
