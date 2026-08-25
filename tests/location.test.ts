import assert from "node:assert/strict";
import test from "node:test";
import { hasProvinceAndCity, normalizeRegion } from "../src/utils/location.ts";

test("normalizeRegion renders ordinary provinces with city", () => {
  assert.equal(normalizeRegion("广东", "深圳"), "广东省深圳市");
  assert.equal(normalizeRegion("广东省", "深圳市"), "广东省深圳市");
  assert.equal(normalizeRegion("浙江", "杭州"), "浙江省杭州市");
  assert.equal(normalizeRegion("浙江省", ""), "浙江省");
});

test("normalizeRegion keeps same-name prefecture city (吉林省吉林市)", () => {
  assert.equal(normalizeRegion("吉林", "吉林"), "吉林省吉林市");
  assert.equal(normalizeRegion("吉林", "吉林市"), "吉林省吉林市");
});

test("normalizeRegion collapses municipalities to the city name", () => {
  assert.equal(normalizeRegion("北京", "北京"), "北京市");
  assert.equal(normalizeRegion("北京市", "北京市"), "北京市");
  assert.equal(normalizeRegion("上海", ""), "上海市");
  assert.equal(normalizeRegion("重庆", "重庆市"), "重庆市");
});

test("normalizeRegion expands autonomous regions and preserves their cities", () => {
  assert.equal(normalizeRegion("广西", "南宁"), "广西壮族自治区南宁市");
  assert.equal(
    normalizeRegion("广西壮族自治区", "南宁市"),
    "广西壮族自治区南宁市",
  );
  assert.equal(
    normalizeRegion("新疆维吾尔自治区", "乌鲁木齐"),
    "新疆维吾尔自治区乌鲁木齐市",
  );
  assert.equal(normalizeRegion("内蒙古", "呼和浩特"), "内蒙古自治区呼和浩特市");
});

test("normalizeRegion renders special administrative regions without 省", () => {
  assert.equal(normalizeRegion("香港", ""), "香港特别行政区");
  assert.equal(normalizeRegion("香港特别行政区", "香港"), "香港特别行政区");
  assert.equal(normalizeRegion("澳门", "澳门"), "澳门特别行政区");
});

test("normalizeRegion keeps autonomous prefecture and league names intact", () => {
  assert.equal(
    normalizeRegion("甘肃", "临夏回族自治州"),
    "甘肃省临夏回族自治州",
  );
  assert.equal(
    normalizeRegion("云南", "德宏傣族景颇族自治州"),
    "云南省德宏傣族景颇族自治州",
  );
  assert.equal(normalizeRegion("内蒙古", "阿拉善盟"), "内蒙古自治区阿拉善盟");
});

test("hasProvinceAndCity accepts precise region text only", () => {
  assert.ok(hasProvinceAndCity("广东省深圳市"));
  assert.ok(hasProvinceAndCity("吉林省吉林市"));
  assert.ok(hasProvinceAndCity("广西壮族自治区南宁市"));
  assert.ok(hasProvinceAndCity("北京市"));
  assert.ok(hasProvinceAndCity("香港特别行政区"));
  assert.ok(!hasProvinceAndCity("吉林省"));
  assert.ok(!hasProvinceAndCity(""));
});
