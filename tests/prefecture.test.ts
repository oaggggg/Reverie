import assert from "node:assert/strict";
import test from "node:test";
import { bareForm, matchPrefecture } from "../sidecar/prefecture.cjs";
import divisions from "../sidecar/china-divisions.json" with { type: "json" };

const PROVINCES = [
  "河北",
  "山西",
  "内蒙古",
  "辽宁",
  "吉林",
  "黑龙江",
  "江苏",
  "浙江",
  "安徽",
  "福建",
  "江西",
  "山东",
  "河南",
  "湖北",
  "湖南",
  "广东",
  "广西",
  "海南",
  "四川",
  "贵州",
  "云南",
  "西藏",
  "陕西",
  "甘肃",
  "青海",
  "宁夏",
  "新疆",
  "台湾",
];

test("china divisions data covers every province-level region with clean entries", () => {
  assert.deepEqual(Object.keys(divisions), PROVINCES);
  for (const cities of Object.values(divisions)) {
    assert.ok(cities.length > 0);
    for (const city of cities) {
      assert.ok(city.length >= 2);
      assert.ok(/(?:自治州|地区|林区|盟|[市县])$/.test(city));
    }
    assert.equal(new Set(cities).size, cities.length, "duplicate display name");
  }
});

test("matchPrefecture rejects sub-prefecture place names (平潮 is a town, not a city)", () => {
  assert.equal(matchPrefecture("江苏", "平潮"), "");
  assert.equal(matchPrefecture("江苏", "平潮镇"), "");
  assert.equal(matchPrefecture("江苏", "通州区"), "");
  assert.equal(matchPrefecture("重庆", "万州区"), "");
  assert.equal(matchPrefecture("江苏", ""), "");
});

test("matchPrefecture canonicalizes valid prefecture names", () => {
  assert.equal(matchPrefecture("江苏", "南通"), "南通市");
  assert.equal(matchPrefecture("江苏", "南通市"), "南通市");
  assert.equal(matchPrefecture("吉林", "吉林"), "吉林市");
  assert.equal(matchPrefecture("广东", "东莞"), "东莞市");
  assert.equal(matchPrefecture("河南", "济源"), "济源市");
  assert.equal(matchPrefecture("海南", "儋州"), "儋州市");
});

test("matchPrefecture keeps same-suffix variants for shared bare names", () => {
  assert.equal(matchPrefecture("台湾", "新竹县"), "新竹县");
  assert.equal(matchPrefecture("台湾", "新竹市"), "新竹市");
  assert.equal(matchPrefecture("台湾", "新竹"), "新竹市");
});

test("matchPrefecture resolves autonomous prefectures and abbreviations", () => {
  assert.equal(
    matchPrefecture("甘肃", "临夏回族自治州"),
    "临夏回族自治州",
  );
  assert.equal(matchPrefecture("甘肃", "临夏"), "临夏回族自治州");
  assert.equal(matchPrefecture("新疆", "克孜勒苏"), "克孜勒苏柯尔克孜自治州");
  assert.equal(matchPrefecture("青海", "海南"), "海南藏族自治州");
  assert.equal(matchPrefecture("青海", "海西州"), "海西蒙古族藏族自治州");
  assert.equal(matchPrefecture("吉林", "延边州"), "延边朝鲜族自治州");
  assert.equal(matchPrefecture("贵州", "黔东南"), "黔东南苗族侗族自治州");
  assert.equal(matchPrefecture("黑龙江", "大兴安岭"), "大兴安岭地区");
  assert.equal(matchPrefecture("内蒙古", "阿拉善"), "阿拉善盟");
  assert.equal(matchPrefecture("湖北", "神农架"), "神农架林区");
});

test("matchPrefecture rejects cities that belong to another province", () => {
  assert.equal(matchPrefecture("广东", "杭州市"), "");
  assert.equal(matchPrefecture("浙江", "南通"), "");
});

test("bareForm strips exactly one administrative suffix", () => {
  assert.equal(bareForm("南通市"), "南通");
  assert.equal(bareForm("延边朝鲜族自治州"), "延边朝鲜族");
  assert.equal(bareForm("阿拉善盟"), "阿拉善");
  assert.equal(bareForm("大兴安岭地区"), "大兴安岭");
  assert.equal(bareForm("神农架林区"), "神农架");
  assert.equal(bareForm(""), "");
});
