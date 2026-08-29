import { useEffect, useState, type FormEvent } from "react";
import {
  Album,
  Disc3,
  Film,
  Heart,
  ListMusic,
  Mic2,
  Music2,
  Podcast,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type { SearchCategory } from "../api/types";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { useExploreStore } from "../store/exploreStore";
import { usePlayerStore } from "../store/playerStore";
import { useSearchStore } from "../store/searchStore";
import { sizedImage } from "../utils/image";
import { formatCount } from "../utils/formatCount";
import { LoadingState, Page, PageHeader } from "./Page";
import PlaylistGrid from "./PlaylistGrid";
import SongList from "./SongList";
import { useMediaStore } from "../store/mediaStore.ts";

const CATEGORIES: Array<{
  key: SearchCategory;
  label: string;
  icon: typeof Music2;
}> = [
  { key: "songs", label: "歌曲", icon: Music2 },
  { key: "lyrics", label: "歌词", icon: Mic2 },
  { key: "albums", label: "专辑", icon: Album },
  { key: "artists", label: "歌手", icon: UserRound },
  { key: "playlists", label: "歌单", icon: ListMusic },
  { key: "radios", label: "播客", icon: Podcast },
  { key: "users", label: "用户", icon: Users },
  { key: "mvs", label: "MV", icon: Film },
  { key: "videos", label: "视频", icon: Film },
];

function formatDuration(duration: number) {
  const seconds = Math.max(0, Math.floor(duration / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function SearchPage() {
  const keyword = useSearchStore((state) => state.keyword);
  const category = useSearchStore((state) => state.category);
  const result = useSearchStore((state) => state.result);
  const loading = useSearchStore((state) => state.loading);
  const loadingMore = useSearchStore((state) => state.loadingMore);
  const defaultKeyword = useSearchStore((state) => state.defaultKeyword);
  const openSearch = useSearchStore((state) => state.openSearch);
  const setCategory = useSearchStore((state) => state.setCategory);
  const loadMore = useSearchStore((state) => state.loadMore);
  const openMediaDetail = useMediaStore((state) => state.open);
  const toggleFollow = useSearchStore((state) => state.toggleFollow);
  const openPlaylist = usePlayerStore((state) => state.openPlaylist);
  const openAlbum = useExploreStore((state) => state.openAlbum);
  const openArtist = useExploreStore((state) => state.openArtist);
  const openRadio = useExploreStore((state) => state.openRadio);
  const [input, setInput] = useState(keyword);
  const loadMoreRef = useInfiniteScroll(
    () => void loadMore(),
    loadingMore || !result.hasMore,
  );

  useEffect(() => setInput(keyword), [keyword]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void openSearch(input, category);
  };

  const hasItems =
    result.songs.length +
      result.albums.length +
      result.artists.length +
      result.playlists.length +
      result.radios.length +
      result.users.length +
      result.media.length >
    0;

  return (
    <Page>
      <section className="search-page-hero">
        <PageHeader
          title={keyword ? `搜索「${keyword}」` : "搜索"}
          subtitle={
            keyword
              ? `找到 ${formatCount(result.total)} 条相关结果`
              : "查找歌曲、歌词、歌手、专辑、歌单、播客与视频"
          }
        />

        <form className="search-page-form" onSubmit={submit}>
          <Search size={18} />
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={defaultKeyword || "输入歌曲、歌手、专辑或歌词"}
            aria-label="搜索关键词"
          />
          {input && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setInput("")}
              title="清空"
            >
              <X size={16} />
            </button>
          )}
          <button
            type="submit"
            className="btn primary"
            disabled={!input.trim()}
          >
            搜索
          </button>
        </form>

        <div className="search-category-tabs" role="tablist">
          {CATEGORIES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={category === key}
              className={category === key ? "active" : ""}
              onClick={() => void setCategory(key)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <LoadingState label="正在搜索…" />
      ) : !hasItems ? (
        <div className="empty">没有找到相关结果</div>
      ) : (
        <section className="search-result-section">
          {(category === "songs" || category === "lyrics") && (
            <SongList
              songs={result.songs}
              title={category === "lyrics" ? "歌词匹配" : "歌曲"}
            />
          )}

          {category === "playlists" && (
            <PlaylistGrid
              playlists={result.playlists}
              onOpen={openPlaylist}
              showPlayCount
            />
          )}

          {category === "albums" && (
            <div className="media-grid compact">
              {result.albums.map((album) => (
                <button
                  className="media-card"
                  key={album.id}
                  onClick={() => void openAlbum(album.id)}
                >
                  <div className="card-cover">
                    {album.picUrl ? (
                      <img
                        src={sizedImage(album.picUrl, 320)}
                        alt=""
                        loading="lazy"
                      />
                    ) : (
                      <span className="media-placeholder">
                        <Disc3 size={28} />
                      </span>
                    )}
                  </div>
                  <strong>{album.name}</strong>
                  <span>{album.artistNames || "未知歌手"}</span>
                </button>
              ))}
            </div>
          )}

          {category === "artists" && (
            <div className="search-person-grid">
              {result.artists.map((artist) => (
                <button
                  key={artist.id}
                  onClick={() => void openArtist(artist.id)}
                >
                  {artist.picUrl ? (
                    <img
                      src={sizedImage(artist.picUrl, 240)}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <span className="avatar-placeholder">
                      <UserRound size={24} />
                    </span>
                  )}
                  <strong>{artist.name}</strong>
                  <span>
                    {artist.alias.join(" / ") || `${artist.musicSize} 首歌曲`}
                  </span>
                </button>
              ))}
            </div>
          )}

          {category === "radios" && (
            <div className="media-grid compact">
              {result.radios.map((radio) => (
                <button
                  className="media-card"
                  key={radio.id}
                  onClick={() => void openRadio(radio.id)}
                >
                  <div className="card-cover">
                    <img
                      src={sizedImage(radio.picUrl, 320)}
                      alt=""
                      loading="lazy"
                    />
                  </div>
                  <strong>{radio.name}</strong>
                  <span>
                    {radio.djName ||
                      radio.category ||
                      `${radio.programCount} 期`}
                  </span>
                </button>
              ))}
            </div>
          )}

          {category === "users" && (
            <div className="search-user-list">
              {result.users.map((user) => (
                <article key={user.userId}>
                  {user.avatarUrl ? (
                    <img
                      src={sizedImage(user.avatarUrl, 160)}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <span className="avatar-placeholder">
                      <UserRound size={22} />
                    </span>
                  )}
                  <div>
                    <strong>{user.nickname}</strong>
                    <span>{user.signature || "暂无个人介绍"}</span>
                  </div>
                  <button
                    className={`btn ${user.followed ? "active" : ""}`}
                    onClick={() => void toggleFollow(user.userId)}
                  >
                    <Heart
                      size={14}
                      fill={user.followed ? "currentColor" : "none"}
                    />
                    {user.followed ? "已关注" : "关注"}
                  </button>
                </article>
              ))}
            </div>
          )}

          {(category === "mvs" || category === "videos") && (
            <div className="search-video-grid">
              {result.media.map((item) => (
                <button
                  key={`${item.kind}-${item.id}`}
                  onClick={() => void openMediaDetail(item)}
                >
                  <div className="search-video-cover">
                    <img
                      src={sizedImage(item.coverUrl, 480)}
                      alt=""
                      loading="lazy"
                    />
                    <span>{formatDuration(item.duration)}</span>
                  </div>
                  <strong>{item.name}</strong>
                  <small>
                    {item.creatorName || "未知创作者"} ·{" "}
                    {formatCount(item.playCount)} 次播放
                  </small>
                </button>
              ))}
            </div>
          )}

          {result.hasMore && (
            <div ref={loadMoreRef} className="load-more-sentinel" />
          )}
        </section>
      )}
    </Page>
  );
}
