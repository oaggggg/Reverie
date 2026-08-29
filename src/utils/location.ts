const MUNICIPALITIES = new Set(["北京", "上海", "天津", "重庆"]);
const SPECIAL_REGIONS = new Set(["香港", "澳门"]);
const AUTONOMOUS_FULL_NAMES = new Map([
  ["内蒙古", "内蒙古自治区"],
  ["广西", "广西壮族自治区"],
  ["西藏", "西藏自治区"],
  ["宁夏", "宁夏回族自治区"],
  ["新疆", "新疆维吾尔自治区"],
]);

function provinceBare(province: string): string {
  return province
    .trim()
    .replace(/^(?:中国|中华人民共和国)/, "")
    .replace(/(?:维吾尔|壮族|回族)?自治区$|特别行政区$|[省市]$/, "");
}

// 省级行政区统一为官方全称；未带后缀的普通省份按直辖市/省补齐。
function expandProvince(bare: string): string {
  if (AUTONOMOUS_FULL_NAMES.has(bare)) return AUTONOMOUS_FULL_NAMES.get(bare)!;
  if (SPECIAL_REGIONS.has(bare)) return `${bare}特别行政区`;
  if (/(?:省|市|自治区|特别行政区)$/.test(bare)) return bare;
  return `${bare}${MUNICIPALITIES.has(bare) ? "市" : "省"}`;
}

// 城市名补全后缀；自治州/地区/盟/旗保留原名，避免出现“延边朝鲜族市”。
function ensureCitySuffix(city: string): string {
  const trimmed = city.trim();
  if (!trimmed) return "";
  if (/(?:市|县|自治州|地区|盟|旗)$/.test(trimmed)) return trimmed;
  return `${trimmed}市`;
}

/**
 * 把定位服务返回的省/市规范化为展示文本。
 * 规则：
 * - 直辖市与特别行政区城市重名时只显示省级名称（如“北京市”“香港特别行政区”）；
 * - 省市同名（吉林省吉林市）必须同时保留两级，不允许退化成只有省份；
 * - 自治区使用全称（如“广西壮族自治区南宁市”）；
 * - 自治州/盟等保留原名，不追加“市”。
 */
export function normalizeRegion(province: string, city: string): string {
  const p = province.trim();
  const c = city.trim();
  if (!p && !c) return "";
  if (!p) return ensureCitySuffix(c);
  const bare = provinceBare(p);
  const full = expandProvince(bare);
  const cityFull = ensureCitySuffix(c);
  if (!cityFull) return full;
  const cityBare = cityFull.replace(/(?:自治州|[市区县])$|(?:地区|盟)$/, "");
  if (
    (MUNICIPALITIES.has(bare) || SPECIAL_REGIONS.has(bare)) &&
    (cityBare === bare || cityFull === full)
  ) {
    return full;
  }
  return `${full}${cityFull}`;
}

/** 判断展示文本是否已达到“省级 + 市级”精度，用于避免无意义的重复请求。 */
export function hasProvinceAndCity(value: string): boolean {
  return (
    /(?:省|自治区).+(?:市|地区|盟|自治州)$/.test(value) ||
    /^(?:北京|上海|天津|重庆)市$/.test(value) ||
    /^(?:香港|澳门)特别行政区$/.test(value)
  );
}
