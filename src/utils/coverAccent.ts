import { fetchImageBlobUrl } from "../api/client";

export interface CoverAccent {
  color: string;
  soft: string;
}

const FALLBACK: CoverAccent = {
  color: "#7df9ff",
  soft: "rgba(125, 249, 255, 0.32)",
};

/** 近灰度封面（黑白海报、纯文字版封面）的素色兜底，避免突兀的固定青色。 */
const NEUTRAL: CoverAccent = {
  color: "hsl(210 14% 84%)",
  soft: "hsla(210, 14%, 84%, 0.3)",
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toAccent(
  hue: number,
  saturation: number,
  lightness: number,
): CoverAccent {
  const color = `hsl(${Math.round(hue)} ${Math.round(saturation)}% ${Math.round(lightness)}%)`;
  return {
    color,
    soft: `hsla(${Math.round(hue)}, ${Math.round(saturation)}%, ${Math.round(lightness)}%, 0.34)`,
  };
}

/**
 * 拿到一张可以安全读取像素的图：
 * - http(s) 的网易图床地址不返回 CORS 头，直连 <img crossOrigin> 必然
 *   加载失败（这就是取色一直停留在兜底青色的原因），改走本地 sidecar
 *   的图片代理，转成同源 blob URL；
 * - 本地地址（asset:// 壁纸预览等）走 <img crossOrigin> 直连，asset
 *   协议自带 CORS 头，画布不会被污染。
 */
async function loadDrawableImage(url: string): Promise<HTMLImageElement> {
  const source = /^https?:/i.test(url)
    ? await fetchImageBlobUrl(url)
    : url;
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("cover unavailable"));
    image.src = source;
  });
  return image;
}

/** Pick a vivid but readable lyric color from the current album cover. */
export async function extractCoverAccent(url: string): Promise<CoverAccent> {
  if (!url || typeof document === "undefined") return FALLBACK;
  try {
    const image = await loadDrawableImage(url);

    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 48;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return FALLBACK;
    context.drawImage(image, 0, 0, 48, 48);
    const pixels = context.getImageData(0, 0, 48, 48).data;

    // 按 30° 一档做加权色相直方图：权重 = 饱和度 × 居中亮度。相比
    // 只挑单个"得分最高像素"，直方图投票对压缩噪声和局部 outlier
    // 稳健得多，也更贴近封面给人眼的主色调印象。
    const bucketWeight = new Float64Array(12);
    const bucketHue = new Float64Array(12);
    const bucketSat = new Float64Array(12);
    const bucketLight = new Float64Array(12);
    let totalWeight = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] < 128) continue;
      const red = pixels[index] / 255;
      const green = pixels[index + 1] / 255;
      const blue = pixels[index + 2] / 255;
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      const lightness = (max + min) / 2;
      if (lightness < 0.1 || lightness > 0.95) continue;
      const delta = max - min;
      const saturation =
        delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
      if (saturation < 0.06) continue;

      let hue = 0;
      if (delta !== 0) {
        if (max === red) hue = ((green - blue) / delta) % 6;
        else if (max === green) hue = (blue - red) / delta + 2;
        else hue = (red - green) / delta + 4;
        hue *= 60;
        if (hue < 0) hue += 360;
      }
      const weight =
        saturation * (1 - Math.abs(lightness - 0.55) * 0.9);
      const bucket = Math.min(11, Math.floor(hue / 30));
      bucketWeight[bucket] += weight;
      bucketHue[bucket] += hue * weight;
      bucketSat[bucket] += saturation * weight;
      bucketLight[bucket] += lightness * weight;
      totalWeight += weight;
    }

    // 直方图几乎为零 = 近灰度封面，走素色而不是固定青色。
    if (totalWeight < 0.6) return NEUTRAL;

    let best = 0;
    for (let bucket = 1; bucket < 12; bucket++) {
      if (bucketWeight[bucket] > bucketWeight[best]) best = bucket;
    }
    // 得票最高的色相档向相邻档扩散一档，避免主色恰好压在档位边界时
    // 只取到单侧窄带。
    const neighbors = [
      best,
      (best + 1) % 12,
      (best + 11) % 12,
    ].filter((bucket) => bucketWeight[bucket] > 0);
    const hue = neighbors.reduce((sum, b) => sum + bucketHue[b], 0) /
      neighbors.reduce((sum, b) => sum + bucketWeight[b], 0);
    const saturation = neighbors.reduce((sum, b) => sum + bucketSat[b], 0) /
      neighbors.reduce((sum, b) => sum + bucketWeight[b], 0);
    const lightness = neighbors.reduce((sum, b) => sum + bucketLight[b], 0) /
      neighbors.reduce((sum, b) => sum + bucketWeight[b], 0);

    return toAccent(
      hue,
      clamp(saturation * 100 + 14, 58, 92),
      clamp(lightness * 100 + (lightness < 0.5 ? 16 : -10), 52, 74),
    );
  } catch {
    return FALLBACK;
  }
}
