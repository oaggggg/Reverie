"use strict";

const divisions = require("./china-divisions.json");

// 去掉行政区后缀得到“裸名”，用于不同来源间的同名比较。
// 只剥一层后缀，保留专名主体（如“延边朝鲜族自治州”→“延边朝鲜族”）。
const SUFFIX_PATTERN = /(?:自治州|地区|林区|盟|[市县])$/;

function bareForm(name) {
  return String(name || "")
    .trim()
    .replace(SUFFIX_PATTERN, "");
}

const INDEX = new Map();
for (const [province, cities] of Object.entries(divisions)) {
  INDEX.set(
    province,
    cities.map((display) => ({
      display,
      bare: bareForm(display),
      suffix: (display.match(SUFFIX_PATTERN) || [""])[0],
    })),
  );
}

/**
 * 校验并规范化 IP 定位给出的城市名。
 * IP 库的 city 字段可能落到区县/乡镇级（如江苏南通的“平潮”镇），
 * 只有命中所在地省份的地级行政区名录才返回官方全称，
 * 否则返回空串，由调用方降级为仅显示省份，避免拼出不存在的“xx市”。
 */
function matchPrefecture(province, rawCity) {
  const raw = String(rawCity || "").trim();
  if (!raw) return "";
  const entries = INDEX.get(province);
  if (!entries || !entries.length) return "";

  // 全称完全一致
  for (const entry of entries) {
    if (entry.display === raw) return entry.display;
  }

  const bare = bareForm(raw);
  if (!bare || bare.length < 2) return "";
  const rawSuffix = (raw.match(SUFFIX_PATTERN) || [""])[0];
  // “海西州”一类的简称：去掉末尾“州”再比较（结果至少保留两个字，避免“苏州→苏”）。
  const altBare =
    bare.endsWith("州") && bare.length >= 3 ? bare.slice(0, -1) : "";
  const bares = altBare ? [bare, altBare] : [bare];

  // 裸名一致，且后缀类型匹配（区分新竹市/新竹县）
  for (const name of bares) {
    for (const entry of entries) {
      if (
        entry.bare === name &&
        (!rawSuffix || !entry.suffix || entry.suffix === rawSuffix)
      ) {
        return entry.display;
      }
    }
  }
  // 裸名一致即可
  for (const name of bares) {
    for (const entry of entries) {
      if (entry.bare === name) return entry.display;
    }
  }
  // 前缀匹配（“克孜勒苏”→“克孜勒苏柯尔克孜自治州”）
  for (const name of bares) {
    for (const entry of entries) {
      if (
        entry.bare.length >= 2 &&
        (entry.bare.startsWith(name) || name.startsWith(entry.bare))
      ) {
        return entry.display;
      }
    }
  }
  return "";
}

module.exports = { bareForm, matchPrefecture };
