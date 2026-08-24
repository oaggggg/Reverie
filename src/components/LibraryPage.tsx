import { useEffect, useRef, useState } from "react";
import { Disc3, RefreshCw, UserRound } from "lucide-react";
import { getAlbumDirectory, getArtistDirectory, getNewestAlbums, getTopAlbums, getTopArtists, type AlbumArea } from "../api/library";
import type { AlbumInfo, ArtistInfo } from "../api/types";
import { useExploreStore } from "../store/exploreStore";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { usePlayerStore } from "../store/playerStore";
import { sizedImage } from "../utils/image";
import { LoadingState, Page, PageHeader } from "./Page";

type LibraryTab = "albums" | "artists";
const AREAS: Array<{ value: AlbumArea; label: string }> = [
  { value: "ALL", label: "全部" },
  { value: "ZH", label: "华语" },
  { value: "EA", label: "欧美" },
  { value: "KR", label: "韩国" },
  { value: "JP", label: "日本" },
];
const INITIALS = ["全部", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];

export default function LibraryPage() {
  const [tab, setTab] = useState<LibraryTab>("albums");
  const [area, setArea] = useState<AlbumArea>("ALL");
  const [artistType, setArtistType] = useState(1);
  const [initial, setInitial] = useState("");
  const [albums, setAlbums] = useState<AlbumInfo[]>([]);
  const [artists, setArtists] = useState<ArtistInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [more, setMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const requestRef = useRef(0);
  const openAlbum = useExploreStore((state) => state.openAlbum);
  const openArtist = useExploreStore((state) => state.openArtist);
  const loadMoreRef = useInfiniteScroll(
    () => void loadMore(),
    loading || !more,
  );

  useEffect(() => {
    let alive = true;
    requestRef.current += 1;
    setLoading(true);
    setOffset(0);
    setMore(false);
    const loadAlbums = async () => {
      const [directory, newest, top] = await Promise.all([
        getAlbumDirectory(area),
        getNewestAlbums().catch(() => []),
        getTopAlbums(area).catch(() => []),
      ]);
      if (!alive) return;
      const seen = new Set<number>();
      const merged = [...directory.albums, ...newest, ...top].filter((item) =>
        seen.has(item.id) ? false : (seen.add(item.id), true),
      );
      setAlbums(merged.slice(0, 60));
      setMore(directory.more);
    };
    const loadArtists = async () => {
      const directory = await getArtistDirectory(
        area === "ALL" ? -1 : area === "ZH" ? 7 : area === "EA" ? 96 : area === "JP" ? 8 : 16,
        artistType,
        initial || undefined,
      );
      const popular = await getTopArtists().catch(() => []);
      if (!alive) return;
      const seen = new Set<number>();
      setArtists([...directory.artists, ...popular].filter((item) => seen.has(item.id) ? false : (seen.add(item.id), true)).slice(0, 60));
      setMore(directory.more);
    };
    void (tab === "albums" ? loadAlbums() : loadArtists())
      .catch(() => {
        if (alive) usePlayerStore.getState().toast("加载音乐馆内容失败", "error");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [area, artistType, initial, refreshKey, tab]);

  const loadMore = async () => {
    const token = requestRef.current;
    const nextOffset = offset + 30;
    setLoading(true);
    try {
      if (tab === "albums") {
        const result = await getAlbumDirectory(area, nextOffset);
        if (token !== requestRef.current) return;
        setAlbums((current) => [...current, ...result.albums.filter((item) => !current.some((entry) => entry.id === item.id))]);
        setMore(result.more);
      } else {
        const result = await getArtistDirectory(area === "ALL" ? -1 : area === "ZH" ? 7 : area === "EA" ? 96 : area === "JP" ? 8 : 16, artistType, initial || undefined, nextOffset);
        if (token !== requestRef.current) return;
        setArtists((current) => [...current, ...result.artists.filter((item) => !current.some((entry) => entry.id === item.id))]);
        setMore(result.more);
      }
      setOffset(nextOffset);
    } catch {
      if (token === requestRef.current) usePlayerStore.getState().toast("加载更多失败", "error");
    } finally {
      if (token === requestRef.current) setLoading(false);
    }
  };

  return (
    <Page>
      <PageHeader
        title="音乐馆"
        subtitle="浏览新碟、热门专辑和歌手目录"
        actions={<button className="btn" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}><RefreshCw size={15} /> 刷新</button>}
      />
      <div className="library-tabs" role="tablist">
        <button className={tab === "albums" ? "active" : ""} onClick={() => setTab("albums")}><Disc3 size={15} /> 专辑</button>
        <button className={tab === "artists" ? "active" : ""} onClick={() => setTab("artists")}><UserRound size={15} /> 歌手</button>
      </div>
      <div className="library-filters">
        {tab === "albums" ? AREAS.map((item) => <button key={item.value} className={area === item.value ? "active" : ""} onClick={() => setArea(item.value)}>{item.label}</button>) : <>
          <select value={artistType} onChange={(event) => setArtistType(Number(event.target.value))}><option value={1}>男歌手</option><option value={2}>女歌手</option><option value={3}>乐队</option></select>
          <div className="library-initials">{INITIALS.map((item) => <button key={item} className={initial === (item === "全部" ? "" : item) ? "active" : ""} onClick={() => setInitial(item === "全部" ? "" : item)}>{item}</button>)}</div>
        </>}
      </div>
      {loading && !(tab === "albums" ? albums.length : artists.length) ? <LoadingState label="正在加载音乐馆…" /> : tab === "albums" ? <div className="media-grid compact">{albums.map((album) => <button className="media-card" key={album.id} onClick={() => void openAlbum(album.id)}><div className="card-cover"><img src={sizedImage(album.picUrl, 320)} alt="" /></div><strong>{album.name}</strong><span>{album.artistNames || "专辑"}</span></button>)}{!albums.length && <div className="empty">暂无专辑</div>}</div> : <div className="search-person-grid">{artists.map((artist) => <button key={artist.id} onClick={() => void openArtist(artist.id)}>{artist.picUrl ? <img src={sizedImage(artist.picUrl, 240)} alt="" /> : <span className="avatar-placeholder"><UserRound size={24} /></span>}<strong>{artist.name}</strong><span>{artist.alias.join(" / ") || `${artist.musicSize} 首歌曲`}</span></button>)}{!artists.length && <div className="empty">暂无歌手</div>}</div>}
      {more && <div ref={loadMoreRef} className="load-more-sentinel" />}
    </Page>
  );
}
