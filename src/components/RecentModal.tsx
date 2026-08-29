import { useEffect, type ReactNode } from "react";
import { Disc3, ListMusic, Play, Podcast, X } from "lucide-react";
import { usePlayerStore } from "../store/playerStore";
import { useRecentStore } from "../store/recentStore.ts";
import { useMediaStore } from "../store/mediaStore.ts";
import { useExploreStore } from "../store/exploreStore.ts";
import { sizedImage } from "../utils/image";
import { useOriginTransition } from "../utils/originTransition";
import { useModalBehavior } from "../utils/modalBehavior";
import { LoadingState } from "./Page";
import SongList from "./SongList";

const TABS = [
  ["songs", "歌曲"],
  ["albums", "专辑"],
  ["playlists", "歌单"],
  ["radios", "播客"],
  ["videos", "视频"],
] as const;

function Cover({ src, fallback }: { src: string; fallback: ReactNode }) {
  return src ? (
    <img src={sizedImage(src, 240)} alt="" />
  ) : (
    <span>{fallback}</span>
  );
}

export default function RecentModal() {
  const showRecent = usePlayerStore((s) => s.showRecent);
  const setShowRecent = usePlayerStore((s) => s.setShowRecent);
  const recentSongs = usePlayerStore((s) => s.recentSongs);
  const category = useRecentStore((s) => s.category);
  const songs = useRecentStore((s) => s.songs);
  const albums = useRecentStore((s) => s.albums);
  const playlists = useRecentStore((s) => s.playlists);
  const radios = useRecentStore((s) => s.radios);
  const media = useRecentStore((s) => s.media);
  const loading = useRecentStore((s) => s.loading);
  const setCategory = useRecentStore((s) => s.setCategory);
  const load = useRecentStore((s) => s.load);
  const openMedia = useMediaStore((s) => s.open);
  const openAlbum = useExploreStore((s) => s.openAlbum);
  const openRadio = useExploreStore((s) => s.openRadio);
  const openPlaylist = usePlayerStore((s) => s.openPlaylist);

  const transition = useOriginTransition(showRecent, "recent-modal", 220);
  useModalBehavior(
    showRecent,
    transition.surfaceRef,
    () => setShowRecent(false),
  );

  useEffect(() => {
    if (!showRecent) return;
    void load();
  }, [showRecent, load]);

  if (!transition.rendered) return null;

  const displaySongs = songs.length ? songs : recentSongs;

  return (
    <div
      className={`modal-backdrop ${transition.backdropClassName}`}
      onClick={() => setShowRecent(false)}
    >
      <div
        ref={transition.surfaceRef}
        className={`modal recent-modal ${transition.surfaceClassName}`}
        role="dialog"
        aria-modal="true"
        aria-label="最近播放"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="notification-modal-head">
          <h2>最近播放</h2>
          <span className="notification-modal-sub">云端与本地播放记录</span>
          <div className="notification-modal-actions">
            <button
              className="topnav-icon-btn"
              title="关闭"
              onClick={() => setShowRecent(false)}
            >
              <X size={16} />
            </button>
          </div>
        </header>
        <div className="collection-tabs recent-tabs" role="tablist">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              className={category === id ? "active" : ""}
              onClick={() => void setCategory(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="recent-modal-body">
          {loading ? (
            <LoadingState label="正在加载最近记录…" />
          ) : category === "songs" ? (
            <SongList songs={displaySongs} emptyText="暂无播放记录" />
          ) : category === "albums" ? (
            <div className="recent-card-grid">
              {albums.length ? albums.map((item) => (
                <button
                  key={item.id}
                  className="recent-card"
                  onClick={() => void openAlbum(item.id)}
                >
                  <div className="recent-card-cover">
                    <Cover src={item.coverUrl} fallback={<Disc3 size={24} />} />
                  </div>
                  <strong>{item.name}</strong>
                  <span>{item.artistName || "未知歌手"}</span>
                </button>
              )) : <div className="empty">暂无最近播放的专辑</div>}
            </div>
          ) : category === "playlists" ? (
            <div className="recent-card-grid">
              {playlists.length ? playlists.map((item) => (
                <button
                  key={item.id}
                  className="recent-card"
                  onClick={() => void openPlaylist(item.id, item.name)}
                >
                  <div className="recent-card-cover">
                    <Cover
                      src={item.coverUrl}
                      fallback={<ListMusic size={24} />}
                    />
                  </div>
                  <strong>{item.name}</strong>
                  <span>{item.creatorName || "歌单"}</span>
                </button>
              )) : <div className="empty">暂无最近播放的歌单</div>}
            </div>
          ) : category === "radios" ? (
            <div className="recent-card-grid">
              {radios.length ? radios.map((item) => (
                <button
                  key={item.id}
                  className="recent-card"
                  onClick={() => void openRadio(item.id)}
                >
                  <div className="recent-card-cover">
                    <Cover src={item.coverUrl} fallback={<Podcast size={24} />} />
                  </div>
                  <strong>{item.name}</strong>
                  <span>{item.creatorName || "播客"}</span>
                </button>
              )) : <div className="empty">暂无最近播放的播客</div>}
            </div>
          ) : (
            <div className="recent-card-grid">
              {media.length ? media.map((item) => (
                <button
                  key={`${item.kind}-${item.id}`}
                  className="recent-card"
                  onClick={() => void openMedia(item)}
                >
                  <div className="recent-card-cover">
                    <Cover src={item.coverUrl} fallback={<Podcast size={24} />} />
                    <Play size={14} fill="currentColor" />
                  </div>
                  <strong>{item.name}</strong>
                  <span>{item.creatorName || "未知创作者"}</span>
                </button>
              )) : <div className="empty">暂无最近播放的视频</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
