export interface CoverAccent {
  color: string;
  soft: string;
}

const FALLBACK: CoverAccent = {
  color: "#7df9ff",
  soft: "rgba(125, 249, 255, 0.32)",
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

/** Pick a vivid but readable lyric color from the current album cover. */
export async function extractCoverAccent(url: string): Promise<CoverAccent> {
  if (!url || typeof document === "undefined") return FALLBACK;
  try {
    const image = new Image();
    image.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("cover unavailable"));
      image.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return FALLBACK;
    context.drawImage(image, 0, 0, 32, 32);
    const pixels = context.getImageData(0, 0, 32, 32).data;
    let best = { score: -1, hue: 190, saturation: 70, lightness: 62 };

    for (let index = 0; index < pixels.length; index += 16) {
      const red = pixels[index] / 255;
      const green = pixels[index + 1] / 255;
      const blue = pixels[index + 2] / 255;
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      const delta = max - min;
      const lightness = (max + min) / 2;
      const saturation =
        delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
      if (saturation < 0.18 || lightness < 0.16 || lightness > 0.9) continue;

      let hue = 0;
      if (delta !== 0) {
        if (max === red) hue = ((green - blue) / delta) % 6;
        else if (max === green) hue = (blue - red) / delta + 2;
        else hue = (red - green) / delta + 4;
        hue *= 60;
        if (hue < 0) hue += 360;
      }
      const score = saturation * 0.72 + (1 - Math.abs(lightness - 0.55)) * 0.28;
      if (score > best.score) {
        best = { score, hue, saturation, lightness };
      }
    }

    return toAccent(
      best.hue,
      clamp(best.saturation * 100 + 8, 58, 92),
      clamp(best.lightness * 100 + (best.lightness < 0.5 ? 14 : -12), 52, 72),
    );
  } catch {
    return FALLBACK;
  }
}
