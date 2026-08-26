import { useEffect, useState } from "react";
import { Heart, X } from "lucide-react";
import {
  getArtistMvs,
  getArtistSongs,
  getArtistTopSongs,
} from "../api/artist";
import type { SearchMediaInfo, Song } from "../api/types";
import { useExploreStore } from "../store/exploreStore";
import { useMediaStore } from "../store/mediaStore";
import { usePlayerStore } from "../store/playerStore";
import { sizedImage } from "../utils/image";
import { openAlbumModal } from "../utils/detailModals";
import { useOriginTransition } from "../utils/originTransition";
import { useModalBehavior } from "../utils/modalBehavior";
import { LoadingState } from "./Page";
import SongList from "./SongList";

const TABS = [
  ["hot", "热门歌曲"],
  ["all", "全部歌曲"],
  ["albums", "专辑"],
  ["mvs", "歌手MV"],
] as const;

type Tab = (typeof TABS)[number][0];

/** 歌手详情弹窗：歌手信息下方以标签页切换热门歌曲 / 全部歌曲 / 专辑 / 歌手MV。 */
export default function ArtistModal() {
  const show = usePlayerStore((s) => s.showArtistModal);
  const setShow = usePlayerStore((s) => s.setShowArtistModal);
  const artist = useExploreStore((s) => s.artist);
  const songs = useExploreStore((s) => s.artistSongs);
  const albums = useExploreStore((s) => s.artistAlbums);
  const loading = useExploreStore((s) => s.loading);
  const toggleSubscription = useExploreStore((s) => s.toggleArtistSubscription);
  const openMedia = useMediaStore((s) => s.open);

  const [tab, setTab] = useState<Tab>("hot");
  const [topSongs, setTopSongs] = useState<Song[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [artistMvs, setArtistMvs] = useState<SearchMediaInfo[]>([]);

  const transition = useOriginTransition(show, "artist-detail-modal", 220);
  useModalBehavior(show, transition.surfaceRef, () => setShow(false));

  // 每次打开或切换歌手时拉取标签页所需数据（与歌手页面同源接口）。
  useEffect(() => {
    if (!show || !artist?.id) {
      setTopSongs([]);
      setAllSongs([]);
      setArtistMvs([]);
      return;
    }
    let alive = true;
    void Promise.allSettled([
      getArtistTopSongs(artist.id),
      getArtistSongs(artist.id),
      getArtistMvs(artist.id),
    ]).then(([topResult, allResult, mvsResult]) => {
      if (!alive) return;
      setTopSongs(topResult.status === "fulfilled" ? topResult.value : []);
      setAllSongs(allResult.status === "fulfilled" ? allResult.value : []);
      setArtistMvs(mvsResult.status === "fulfilled" ? mvsResult.value : []);
    });
    return () => {
      alive = false;
    };
  }, [show, artist?.id]);

  // 切换歌手时回到第一个标签页。
  useEffect(() => {
    setTab("hot");
  }, [artist?.id]);

  if (!transition.rendered) return null;

  const hotList = topSongs.length ? topSongs : songs;

  return (
    <div
      className={`modal-backdrop ${transition.backdropClassName}`}
      onClick={() => setShow(false)}
    >
      <div
        ref={transition.surfaceRef}
        className={`modal detail-modal ${transition.surfaceClassName}`}
        role="dialog"
        aria-modal="true"
        aria-label="歌手详情"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="topnav-icon-btn detail-modal-close"
          title="关闭"
          onClick={() => setShow(false)}
        >
          <X size={16} />
        </button>
        <div className="detail-modal-inner">
          {!artist ? (
            loading ? (
              <LoadingState label="正在加载歌手…" />
            ) : (
              <div className="empty">歌手不存在</div>
            )
          ) : (
            <>
              <section className="detail-hero artist-hero">
                <img
                  className="detail-cover round"
                  src={sizedImage(artist.picUrl, 480)}
                  alt=""
                />
                <div className="detail-copy">
                  <span className="detail-kind">歌手</span>
                  <h1>{artist.name}</h1>
                  {artist.alias.length > 0 && (
                    <div className="detail-alias">
                      {artist.alias.join(" / ")}
                    </div>
                  )}
                  <p>{artist.briefDesc || "暂无歌手介绍"}</p>
                  <div className="detail-actions">
                    <button
                      className={`btn ${artist.followed ? "active" : "primary"}`}
                      onClick={() => void toggleSubscription()}
                    >
                      <Heart
                        size={15}
                        fill={artist.followed ? "currentColor" : "none"}
                      />
                      {artist.followed ? "已收藏" : "收藏歌手"}
                    </button>
                  </div>
                </div>
              </section>

              {/* 歌手信息下方的分区导航：切换对应内容区 */}
              <div className="collection-tabs detail-tabs" role="tablist">
                {TABS.map(([id, label]) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={tab === id}
                    className={tab === id ? "active" : ""}
                    onClick={() => setTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="detail-modal-body">
                {tab === "hot" ? (
                  hotList.length ? (
                    <SongList songs={hotList} title="热门歌曲" />
                  ) : loading ? (
                    <LoadingState label="正在加载热门歌曲…" />
                  ) : (
                    <div className="empty">暂无热门歌曲</div>
                  )
                ) : tab === "all" ? (
                  allSongs.length ? (
                    <SongList songs={allSongs} title="全部歌曲" />
                  ) : (
                    <LoadingState label="正在加载全部歌曲…" />
                  )
                ) : tab === "albums" ? (
                  albums.length ? (
                    <>
                      <div className="list-header">
                        <h3>专辑</h3>
                        <span className="count">{albums.length} 张</span>
                      </div>
                      <div className="media-grid compact">
                        {albums.map((album) => (
                          <button
                            key={album.id}
                            className="media-card"
                            onClick={() => openAlbumModal(album.id)}
                          >
                            <div className="card-cover">
                              <img
                                src={sizedImage(album.picUrl, 320)}
                                alt=""
                                loading="lazy"
                              />
                            </div>
                            <strong>{album.name}</strong>
                            <span>
                              {album.publishTime
                                ? new Date(album.publishTime).getFullYear()
                                : ""}
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="empty">暂无专辑</div>
                  )
                ) : artistMvs.length ? (
                  <>
                    <div className="list-header">
                      <h3>歌手 MV</h3>
                      <span className="count">{artistMvs.length} 个</span>
                    </div>
                    <div className="media-grid compact">
                      {artistMvs.map((video) => (
                        <button
                          key={video.id}
                          className="media-card"
                          onClick={() => void openMedia(video)}
                        >
                          <div className="card-cover">
                            <img
                              src={sizedImage(video.coverUrl, 320)}
                              alt=""
                              loading="lazy"
                            />
                          </div>
                          <strong>{video.name}</strong>
                          <span>{video.creatorName || artist.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <LoadingState label="正在加载歌手 MV…" />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
