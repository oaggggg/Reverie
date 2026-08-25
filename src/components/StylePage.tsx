import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Compass, Disc3, ListMusic, RefreshCw, UserRound } from "lucide-react";
import {
  getStyleAlbums,
  getStyleArtists,
  getStyleDetail,
  getStylePlaylists,
  getStylePreference,
  getStyleSongs,
  getStyleTags,
} from "../api/style";
import type {
  AlbumInfo,
  ArtistInfo,
  PlaylistInfo,
  Song,
  StyleDetail,
  StyleTag,
} from "../api/types";
import { useExploreStore } from "../store/exploreStore";
import { usePlayerStore } from "../store/playerStore";
import { sizedImage } from "../utils/image";
import PlaylistGrid from "./PlaylistGrid";
import SongList from "./SongList";
import { LoadingState, Page, PageHeader } from "./Page";

type ContentTab = "songs" | "artists" | "albums" | "playlists";

export default function StylePage() {
  const [tags, setTags] = useState<StyleTag[]>([]);
  const [preference, setPreference] = useState<StyleTag[]>([]);
  const [selectedTag, setSelectedTag] = useState<StyleTag | null>(null);
  const [detail, setDetail] = useState<StyleDetail | null>(null);
  const [tab, setTab] = useState<ContentTab>("songs");
  const [songs, setSongs] = useState<Song[]>([]);
  const [artists, setArtists] = useState<ArtistInfo[]>([]);
  const [albums, setAlbums] = useState<AlbumInfo[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistInfo[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const openPlaylist = usePlayerStore((state) => state.openPlaylist);
  const openAlbum = useExploreStore((state) => state.openAlbum);
  const openArtist = useExploreStore((state) => state.openArtist);

  useEffect(() => {
    let alive = true;
    setLoadingTags(true);
    void Promise.all([getStyleTags(), getStylePreference()])
      .then(([allTags, preferred]) => {
        if (!alive) return;
        setTags(allTags);
        setPreference(preferred);
        setSelectedTag(preferred[0] ?? allTags[0] ?? null);
      })
      .catch(() => {
        if (alive) usePlayerStore.getState().toast("加载风格列表失败", "error");
      })
      .finally(() => {
        if (alive) setLoadingTags(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const tagId = selectedTag?.id;
    if (!tagId) return;
    setLoadingContent(true);
    setDetail(null);
    setSongs([]);
    setArtists([]);
    setAlbums([]);
    setPlaylists([]);
    void Promise.all([
      getStyleDetail(tagId),
      getStyleSongs(tagId),
      getStyleArtists(tagId),
      getStyleAlbums(tagId),
      getStylePlaylists(tagId),
    ])
      .then(
        ([nextDetail, nextSongs, nextArtists, nextAlbums, nextPlaylists]) => {
          if (!alive) return;
          setDetail(nextDetail);
          setSongs(nextSongs);
          setArtists(nextArtists);
          setAlbums(nextAlbums);
          setPlaylists(nextPlaylists);
        },
      )
      .catch(() => {
        if (alive) usePlayerStore.getState().toast("加载风格内容失败", "error");
      })
      .finally(() => {
        if (alive) setLoadingContent(false);
      });
    return () => {
      alive = false;
    };
  }, [refreshKey, selectedTag?.id]);

  const visibleTags = useMemo(() => {
    const preferredIds = new Set(preference.map((item) => item.id));
    return [...tags].sort(
      (a, b) => Number(preferredIds.has(b.id)) - Number(preferredIds.has(a.id)),
    );
  }, [preference, tags]);

  const tabs: Array<{
    id: ContentTab;
    label: string;
    icon: ReactElement;
    count: number;
  }> = [
    {
      id: "songs",
      label: "歌曲",
      icon: <Disc3 size={15} />,
      count: songs.length,
    },
    {
      id: "artists",
      label: "歌手",
      icon: <UserRound size={15} />,
      count: artists.length,
    },
    {
      id: "albums",
      label: "专辑",
      icon: <Compass size={15} />,
      count: albums.length,
    },
    {
      id: "playlists",
      label: "歌单",
      icon: <ListMusic size={15} />,
      count: playlists.length,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="风格"
        subtitle={detail?.description || "按音乐风格浏览歌曲、歌手、专辑和歌单"}
        actions={
          <button
            className="btn"
            title="刷新风格内容"
            disabled={!selectedTag || loadingContent}
            onClick={() => setRefreshKey((value) => value + 1)}
          >
            <RefreshCw size={15} /> 刷新
          </button>
        }
      />
      {loadingTags ? (
        <LoadingState label="正在加载风格…" />
      ) : !visibleTags.length ? (
        <div className="empty">暂无风格数据</div>
      ) : (
        <>
          <div className="style-tag-strip" role="tablist" aria-label="音乐风格">
            {visibleTags.map((tag) => (
              <button
                key={tag.id}
                className={selectedTag?.id === tag.id ? "active" : ""}
                role="tab"
                aria-selected={selectedTag?.id === tag.id}
                onClick={() => setSelectedTag(tag)}
              >
                {tag.name}
              </button>
            ))}
          </div>
          <div
            className="style-content-tabs"
            role="tablist"
            aria-label="风格内容类型"
          >
            {tabs.map((item) => (
              <button
                key={item.id}
                className={tab === item.id ? "active" : ""}
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
              >
                {item.icon} {item.label} <span>{item.count}</span>
              </button>
            ))}
          </div>
          {loadingContent ? (
            <LoadingState label="正在加载风格内容…" />
          ) : tab === "songs" ? (
            <SongList songs={songs} emptyText="暂无风格歌曲" />
          ) : tab === "artists" ? (
            <div className="media-grid compact">
              {artists.map((artist) => (
                <button
                  className="media-card"
                  key={artist.id}
                  onClick={() => void openArtist(artist.id)}
                >
                  <div className="card-cover">
                    <img src={sizedImage(artist.picUrl, 320)} alt="" />
                  </div>
                  <strong>{artist.name}</strong>
                  <span>
                    {artist.musicSize ? `${artist.musicSize} 首歌曲` : "歌手"}
                  </span>
                </button>
              ))}
              {!artists.length && <div className="empty">暂无风格歌手</div>}
            </div>
          ) : tab === "albums" ? (
            <div className="media-grid compact">
              {albums.map((album) => (
                <button
                  className="media-card"
                  key={album.id}
                  onClick={() => void openAlbum(album.id)}
                >
                  <div className="card-cover">
                    <img src={sizedImage(album.picUrl, 320)} alt="" />
                  </div>
                  <strong>{album.name}</strong>
                  <span>{album.artistNames || "专辑"}</span>
                </button>
              ))}
              {!albums.length && <div className="empty">暂无风格专辑</div>}
            </div>
          ) : (
            <PlaylistGrid
              playlists={playlists}
              onOpen={openPlaylist}
              emptyText="暂无风格歌单"
            />
          )}
        </>
      )}
    </Page>
  );
}
