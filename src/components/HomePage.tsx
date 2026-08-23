import { useEffect, useMemo, useState } from "react";
import { usePlayerStore } from "../store/playerStore";
import { Page } from "./Page";
import PlaylistGrid from "./PlaylistGrid";
import SongCards from "./SongCards";
import { useDiscoveryStore } from "../store/discoveryStore.ts";
import { dislikeRecommendSong } from "../api/client";
import {
  getHomepageBlockPage,
  getHomepageDragonBall,
  type HomepageEntry,
} from "../api/homepage";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const LOCATION_CACHE_KEY = "reverie_home_location";
const LOCATION_CACHE_AT_KEY = "reverie_home_location_at";
const LOCATION_CACHE_TTL = 24 * 60 * 60 * 1000;

function readCachedLocation(): string {
  try {
    return localStorage.getItem(LOCATION_CACHE_KEY) ?? "";
  } catch {
    return "";
  }
}

function isLocationFresh(): boolean {
  try {
    const cachedAt = Number(localStorage.getItem(LOCATION_CACHE_AT_KEY) ?? 0);
    return cachedAt > 0 && Date.now() - cachedAt < LOCATION_CACHE_TTL;
  } catch {
    return false;
  }
}

function cacheLocation(value: string) {
  if (!value) return;
  try {
    localStorage.setItem(LOCATION_CACHE_KEY, value);
    localStorage.setItem(LOCATION_CACHE_AT_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function normalizeRegion(province: string, city: string): string {
  const unit = /(省|市|自治区|特别行政区)$/.test(province);
  const p = unit ? province : `${province}省`;
  if (!city) return p;
  if (city === province || city.replace(/市$/, "") === p.replace(/省|市$/, ""))
    return p;
  const c = city.endsWith("市") ? city : `${city}市`;
  return `${p}${c}`;
}

// WebView 直连公网 IP 服务会被 CORS 拦截，由本地 sidecar 代理；主源带城市粒度。
async function fetchLocation(): Promise<string> {
  try {
    const res = await fetch("http://127.0.0.1:3939/reverie/location", {
      signal: AbortSignal.timeout(4500),
    });
    if (res.ok) {
      const j: { province?: string; city?: string; region?: string } =
        await res.json();
      const province = String(j.province ?? j.region ?? "");
      const city = String(j.city ?? "");
      if (province || city) return normalizeRegion(province, city);
    }
  } catch {
    /* fall through */
  }
  // fallback：文本型 ipip（无城市时仅省级）
  try {
    const res = await fetch("http://127.0.0.1:3939/reverie/location?src=ipip", {
      signal: AbortSignal.timeout(3500),
    });
    const text = await res.text();
    const m = text.match(/来自于：(.+)/);
    if (m) {
      const tokens = m[1].trim().split(/\s+/);
      const carriers = ["移动", "联通", "电信", "铁通"];
      const [country, province = "", maybeCity = ""] = tokens;
      const city = maybeCity && !carriers.includes(maybeCity) ? maybeCity : "";
      if (country === "中国") return normalizeRegion(province, city);
      return [country, province, city].filter(Boolean).join(" ");
    }
  } catch {
    /* fall through */
  }
  return "";
}

export default function HomePage() {
  const hotPlaylists = usePlayerStore((s) => s.hotPlaylists);
  const recommendSongs = usePlayerStore((s) => s.recommendSongs);
  const recommendSongsLoading = usePlayerStore((s) => s.recommendSongsLoading);
  const hotPlaylistsLoading = usePlayerStore((s) => s.hotPlaylistsLoading);
  const homeQuote = usePlayerStore((s) => s.homeQuote);
  const openPlaylist = usePlayerStore((s) => s.openPlaylist);
  const dismissRecommend = (song: import("../api/types").Song) => {
    usePlayerStore.setState((state) => ({
      recommendSongs: state.recommendSongs.filter(
        (item) => item.id !== song.id,
      ),
    }));
    void dislikeRecommendSong(song.id).catch(() =>
      usePlayerStore.getState().toast("暂时无法调整推荐", "error"),
    );
  };
  const recommendResources = useDiscoveryStore((s) => s.recommendResources);
  const starpickComments = useDiscoveryStore((s) => s.starpickComments);
  const loadDiscovery = useDiscoveryStore((s) => s.load);
  const [homepageEntries, setHomepageEntries] = useState<HomepageEntry[]>([]);
  useEffect(() => {
    void loadDiscovery();
  }, [loadDiscovery]);

  useEffect(() => {
    let alive = true;
    void Promise.allSettled([getHomepageDragonBall(), getHomepageBlockPage()]).then(
      ([dragon, blocks]) => {
        if (!alive) return;
        const entries = dragon.status === "fulfilled" ? dragon.value : [];
        const blockEntries =
          blocks.status === "fulfilled"
            ? blocks.value.blocks
                .filter((block) => block.title)
                .map((block) => ({
                  id: block.code,
                  name: block.title,
                  iconUrl: "",
                  target: "",
                }))
            : [];
        const seen = new Set<string>();
        setHomepageEntries(
          [...entries, ...blockEntries].filter((item) => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          }),
        );
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const [now, setNow] = useState(() => new Date());
  const [location, setLocation] = useState(readCachedLocation);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (location && isLocationFresh()) return;
    let cancelled = false;
    const refresh = () => {
      void fetchLocation().then((value) => {
        if (cancelled || !value) return;
        setLocation(value);
        cacheLocation(value);
      });
    };
    const idle = window.requestIdleCallback?.(refresh, { timeout: 4000 });
    const timer = idle === undefined ? window.setTimeout(refresh, 1000) : 0;
    return () => {
      cancelled = true;
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  // 每日推荐歌单优先，不足时用热门歌单补齐，去重后展示一栏
  const dailyPlaylists = useMemo(() => {
    const seen = new Set<number>();
    return [...recommendResources, ...hotPlaylists]
      .filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)))
      .slice(0, 12);
  }, [recommendResources, hotPlaylists]);

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const dateStr = `${now.getMonth() + 1}月${now.getDate()}日 星期${WEEKDAYS[now.getDay()]}`;
  const hour = now.getHours();
  const greeting =
    hour < 6
      ? "夜深了"
      : hour < 12
        ? "上午好"
        : hour < 18
          ? "下午好"
          : "晚上好";

  return (
    <Page>
      <div className="home-hero">
        <div className="hero-left">
          <div className="hero-time">
            {hh}:{mm}
          </div>
          <div className="hero-meta">
            <span>
              {greeting} · {dateStr}
            </span>
            {location && <span className="hero-loc">{location}</span>}
          </div>
        </div>
        <div className="hero-right">
          {homeQuote ? (
            <blockquote className="hero-quote">
              <p>“{homeQuote.text}”</p>
              <cite>—— {homeQuote.source}</cite>
            </blockquote>
          ) : (
            <div className="hero-quote-empty">正在为你挑选一句歌词…</div>
          )}
        </div>
      </div>

      {homepageEntries.length > 0 && (
        <section className="home-section">
          <div className="section-title">
            <h2>首页入口</h2>
          </div>
          <div className="home-entry-grid">
            {homepageEntries.slice(0, 12).map((entry) => (
              <button
                className="link-btn"
                key={entry.id}
                onClick={() => {
                  if (entry.target) {
                    window.open(entry.target, "_blank", "noopener,noreferrer");
                  }
                }}
                title={entry.target || entry.name}
              >
                {entry.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="home-section">
        <div className="section-title">
          <h2>每日推荐</h2>
        </div>
        <SongCards
          songs={recommendSongs.slice(0, 12)}
          loading={recommendSongsLoading}
          onDislike={dismissRecommend}
        />
      </section>

      <section className="home-section">
        <div className="section-title">
          <h2>每日推荐歌单</h2>
        </div>
        <PlaylistGrid
          playlists={dailyPlaylists}
          onOpen={openPlaylist}
          loading={hotPlaylistsLoading}
        />
      </section>

      {starpickComments.length > 0 && (
        <section className="home-section">
          <div className="section-title">
            <h2>星评热评</h2>
          </div>
          <div className="home-comment-grid">
            {starpickComments.slice(0, 6).map((comment) => (
              <article className="home-comment-card" key={`${comment.id}-${comment.content}`}>
                <strong>{comment.nickname}</strong>
                <p>{comment.content}</p>
                <small>赞 {comment.likedCount.toLocaleString("zh-CN")}</small>
              </article>
            ))}
          </div>
        </section>
      )}
    </Page>
  );
}
