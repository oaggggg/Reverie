import { useEffect, useState } from "react";
import { BookOpen, Heart, Users } from "lucide-react";
import {
  getArtistDynamic,
  getArtistIntroduction,
  getArtistNewMvs,
  getArtistMvs,
  getArtistNewSongs,
  getArtistSongs,
  getArtistTopSongs,
  type ArtistDynamic,
  type ArtistIntroduction,
} from "../api/artist.ts";
import { getArtistFans } from "../api/artistFans.ts";
import { getSimilarArtists } from "../api/related";
import type { ArtistFan, ArtistInfo } from "../api/types";
import { useExploreStore } from "../store/exploreStore";
import { useMediaStore } from "../store/mediaStore.ts";
import { sizedImage } from "../utils/image";
import { LoadingState, Page } from "./Page";
import SongList from "./SongList";
import BackButton from "./BackButton";

export default function ArtistPage() {
  const artist = useExploreStore((s) => s.artist);
  const songs = useExploreStore((s) => s.artistSongs);
  const albums = useExploreStore((s) => s.artistAlbums);
  const videos = useExploreStore((s) => s.artistVideos);
  const loading = useExploreStore((s) => s.loading);
  const toggleSubscription = useExploreStore((s) => s.toggleArtistSubscription);
  const openAlbum = useExploreStore((s) => s.openAlbum);
  const openMedia = useMediaStore((s) => s.open);
  const openArtist = useExploreStore((s) => s.openArtist);
  const [similarArtists, setSimilarArtists] = useState<ArtistInfo[]>([]);
  const [fans, setFans] = useState<ArtistFan[]>([]);
  const [fansTotal, setFansTotal] = useState(0);
  const [fansLoading, setFansLoading] = useState(false);
  const [introduction, setIntroduction] = useState<ArtistIntroduction | null>(
    null,
  );
  const [dynamic, setDynamic] = useState<ArtistDynamic | null>(null);
  const [topSongs, setTopSongs] = useState<typeof songs>([]);
  const [newMvs, setNewMvs] = useState<typeof videos>([]);
  const [artistMvs, setArtistMvs] = useState<typeof videos>([]);
  const [newSongs, setNewSongs] = useState<typeof songs>([]);
  const [allSongs, setAllSongs] = useState<typeof songs>([]);

  useEffect(() => {
    let alive = true;
    if (!artist?.id) {
      setSimilarArtists([]);
      return;
    }
    void getSimilarArtists(artist.id)
      .then((items) => {
        if (alive) setSimilarArtists(items.slice(0, 12));
      })
      .catch(() => {
        if (alive) setSimilarArtists([]);
      });
    return () => {
      alive = false;
    };
  }, [artist?.id]);

  useEffect(() => {
    let alive = true;
    if (!artist?.id) {
      setIntroduction(null);
      setDynamic(null);
      setTopSongs([]);
      setNewMvs([]);
      setArtistMvs([]);
      setNewSongs([]);
      setAllSongs([]);
      return;
    }
    void Promise.allSettled([
      getArtistIntroduction(artist.id),
      getArtistDynamic(artist.id),
      getArtistTopSongs(artist.id),
      getArtistNewMvs(),
      getArtistMvs(artist.id),
      getArtistNewSongs(),
      getArtistSongs(artist.id),
    ]).then(
      ([
        description,
        stats,
        songsResult,
        mvsResult,
        artistMvsResult,
        newSongsResult,
        allSongsResult,
      ]) => {
        if (!alive) return;
        setIntroduction(
          description.status === "fulfilled" ? description.value : null,
        );
        setDynamic(stats.status === "fulfilled" ? stats.value : null);
        setTopSongs(
          songsResult.status === "fulfilled" ? songsResult.value : [],
        );
        setNewMvs(mvsResult.status === "fulfilled" ? mvsResult.value : []);
        setArtistMvs(
          artistMvsResult.status === "fulfilled" ? artistMvsResult.value : [],
        );
        setNewSongs(
          newSongsResult.status === "fulfilled" ? newSongsResult.value : [],
        );
        setAllSongs(
          allSongsResult.status === "fulfilled" ? allSongsResult.value : [],
        );
      },
    );
    return () => {
      alive = false;
    };
  }, [artist?.id]);

  useEffect(() => {
    let alive = true;
    if (!artist?.id) {
      setFans([]);
      setFansTotal(0);
      return;
    }
    setFansLoading(true);
    void getArtistFans(artist.id)
      .then((result) => {
        if (!alive) return;
        setFans(result.fans);
        setFansTotal(result.total);
      })
      .catch(() => {
        if (!alive) return;
        setFans([]);
        setFansTotal(0);
      })
      .finally(() => {
        if (alive) setFansLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [artist?.id]);

  return (
    <Page>
      {!artist ? (
        loading ? (
          <LoadingState label="正在加载歌手…" />
        ) : (
          <div className="empty">歌手不存在</div>
        )
      ) : (
        <>
          <BackButton />
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
                <div className="detail-alias">{artist.alias.join(" / ")}</div>
              )}
              <p>
                {introduction?.briefDesc || artist.briefDesc || "暂无歌手介绍"}
              </p>
              <div className="detail-meta">
                <span>
                  {dynamic?.musicSize || artist.musicSize || songs.length}{" "}
                  首歌曲
                </span>
                <span>
                  {dynamic?.albumSize || artist.albumSize || albums.length}{" "}
                  张专辑
                </span>
                {(dynamic?.mvSize ?? 0) > 0 && (
                  <span>{dynamic?.mvSize} 个 MV</span>
                )}
              </div>
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
          {(fansLoading || fans.length > 0 || fansTotal > 0) && (
            <section className="artist-fans-section">
              <div className="list-header">
                <h3>
                  <Users size={16} /> 粉丝
                </h3>
                <span className="count">{fansTotal || fans.length} 位</span>
              </div>
              {fansLoading ? (
                <LoadingState label="正在加载歌手粉丝…" />
              ) : (
                <div className="artist-fans-grid">
                  {fans.map((fan) => (
                    <div className="artist-fan" key={fan.userId}>
                      {fan.avatarUrl ? (
                        <img
                          src={sizedImage(fan.avatarUrl, 120)}
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <span className="artist-fan-placeholder">
                          <Users size={16} />
                        </span>
                      )}
                      <div>
                        <strong>{fan.nickname}</strong>
                        {fan.signature && <small>{fan.signature}</small>}
                      </div>
                    </div>
                  ))}
                  {!fans.length && <div className="empty">暂无粉丝列表</div>}
                </div>
              )}
            </section>
          )}
          {introduction?.introduction.length ? (
            <section className="artist-introduction">
              <div className="list-header">
                <h3>
                  <BookOpen size={16} /> 歌手介绍
                </h3>
              </div>
              {introduction.introduction.map((item, index) => (
                <article key={`${item.title}-${index}`}>
                  {item.title && <strong>{item.title}</strong>}
                  {item.content && <p>{item.content}</p>}
                </article>
              ))}
            </section>
          ) : null}
          <SongList
            songs={topSongs.length ? topSongs : songs}
            title="热门歌曲"
          />
          {newSongs.length > 0 && (
            <SongList songs={newSongs} title="网易云最新作品" />
          )}
          {allSongs.length > 0 && (
            <SongList songs={allSongs} title="全部歌曲" />
          )}
          <div className="list-header">
            <h3>专辑</h3>
            <span className="count">{albums.length} 张</span>
          </div>
          {newMvs.length > 0 && (
            <>
              <div className="list-header">
                <h3>最新 MV</h3>
                <span className="count">{newMvs.length} 个</span>
              </div>
              <div className="media-grid compact">
                {newMvs.map((video) => (
                  <button
                    className="media-card"
                    key={video.id}
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
                    <span>{video.creatorName || "MV"}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {artistMvs.length > 0 && (
            <>
              <div className="list-header">
                <h3>歌手 MV</h3>
                <span className="count">{artistMvs.length} 个</span>
              </div>
              <div className="media-grid compact">
                {artistMvs.map((video) => (
                  <button
                    className="media-card"
                    key={video.id}
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
          )}
          <div className="media-grid compact">
            {albums.map((album) => (
              <button
                className="media-card"
                key={album.id}
                onClick={() => void openAlbum(album.id)}
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
          {videos.length > 0 && (
            <>
              <div className="list-header">
                <h3>相关视频</h3>
                <span className="count">{videos.length} 个</span>
              </div>
              <div className="media-grid compact">
                {videos.map((video) => (
                  <button
                    className="media-card"
                    key={video.id}
                    onClick={() => void openMedia(video)}
                  >
                    <div className="card-cover">
                      <img src={sizedImage(video.coverUrl, 320)} alt="" />
                    </div>
                    <strong>{video.name}</strong>
                    <span>{video.creatorName || "视频"}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {similarArtists.length > 0 && (
            <>
              <div className="list-header">
                <h3>相似歌手</h3>
                <span className="count">{similarArtists.length} 位</span>
              </div>
              <div className="media-grid compact">
                {similarArtists.map((item) => (
                  <button
                    className="media-card"
                    key={item.id}
                    onClick={() => void openArtist(item.id)}
                  >
                    <div className="card-cover">
                      <img
                        src={sizedImage(item.picUrl, 320)}
                        alt=""
                        loading="lazy"
                      />
                    </div>
                    <strong>{item.name}</strong>
                    <span>
                      {item.musicSize ? `${item.musicSize} 首歌曲` : "歌手"}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Page>
  );
}
