import { sizedImage } from "./image";

let viewPromise: ReturnType<typeof importNowPlaying> | null = null;
let particlePromise: ReturnType<typeof importParticleCover> | null = null;

const importNowPlaying = () => import("../components/NowPlayingView");
const importParticleCover = () => import("../components/ParticleAlbumCover");

export function loadNowPlayingView() {
  viewPromise ??= importNowPlaying();
  return viewPromise;
}

export function loadParticleAlbumCover() {
  particlePromise ??= importParticleCover();
  return particlePromise;
}

function preloadCover(url: string) {
  warmCoverImage(url, 760);
}

/** 已完成解码/已在队列中的图片缓存键："url|size"。 */
const warmedImages = new Set<string>();
const warmingImages = new Map<string, HTMLImageElement>();

/**
 * 预热任意尺寸的封面缩略图：提前把 CDN 图拉进 HTTP 缓存并完成解码，
 * 等真正 <img> 挂载时直接命中缓存，切换歌曲不再出现空白闪动。
 * 相同 url+size 只会请求一次。
 */
export function warmCoverImage(url: string | undefined, size: number): void {
  if (!url || typeof Image === "undefined") return;
  const key = `${url}|${size}`;
  if (warmedImages.has(key) || warmingImages.has(key)) return;
  const image = new Image();
  warmingImages.set(key, image);
  image.decoding = "async";
  image.src = sizedImage(url, size);
  const done = () => {
    warmingImages.delete(key);
    warmedImages.add(key);
  };
  if (typeof image.decode === "function") {
    void image.decode().then(done, () => warmingImages.delete(key));
  } else {
    image.onload = done;
    image.onerror = () => warmingImages.delete(key);
  }
}

export function preloadNowPlayingAssets(
  coverUrl: string | undefined,
  includeParticles: boolean,
) {
  void loadNowPlayingView();
  if (includeParticles) void loadParticleAlbumCover();
  if (coverUrl) preloadCover(coverUrl);
}
