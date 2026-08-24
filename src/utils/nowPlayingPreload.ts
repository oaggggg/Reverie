import { sizedImage } from "./image";

let viewPromise: ReturnType<typeof importNowPlaying> | null = null;
let particlePromise: ReturnType<typeof importParticleCover> | null = null;
const pendingImages = new Map<string, HTMLImageElement>();
const decodedImages = new Set<string>();

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
  if (!url || decodedImages.has(url) || pendingImages.has(url)) return;
  const image = new Image();
  pendingImages.set(url, image);
  image.decoding = "async";
  image.src = sizedImage(url, 760);
  const done = () => {
    pendingImages.delete(url);
    decodedImages.add(url);
  };
  if (typeof image.decode === "function") {
    void image.decode().then(done, () => pendingImages.delete(url));
  } else {
    image.onload = done;
    image.onerror = () => pendingImages.delete(url);
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
