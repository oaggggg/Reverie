import { useState, type ReactNode } from "react";
import {
  Clapperboard,
  Disc3,
  Heart,
  Play,
  Podcast,
  UserRound,
  X,
} from "lucide-react";
import type { CollectionCategory, SearchMediaInfo } from "../api/types";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { useCollectionStore } from "../store/collectionStore";
import { sizedImage } from "../utils/image";
import { useMediaStore } from "../store/mediaStore.ts";
import BackButton from "./BackButton";
import { LoadingState, Page, PageHeader } from "./Page";

const TABS: Array<{ id: CollectionCategory; label: string }> = [
  { id: "albums", label: "专辑" },
  { id: "artists", label: "歌手" },
  { id: "mvs", label: "MV" },
  { id: "radios", label: "播客" },
];

function MediaCard({ item }: { item: SearchMediaInfo }) {
  const [coverFailed, setCoverFailed] = useState(false);
  const unsubscribe = useCollectionStore((state) => state.unsubscribe);
  const openMediaDetail = useMediaStore((state) => state.open);
  return (
    <article className="media-card collection-media-card">
      <button
        className="card-cover collection-media-button"
        onClick={() => void openMediaDetail(item)}
      >
        {item.coverUrl && !coverFailed ? (
          <img
            src={sizedImage(item.coverUrl, 360)}
            alt=""
            onError={() => setCoverFailed(true)}
          />
        ) : (
          <Clapperboard size={28} />
        )}
        <span className="collection-play">
          <Play size={16} fill="currentColor" />
        </span>
      </button>
      <strong>{item.name}</strong>
      <span>{item.creatorName || "未知歌手"}</span>
      <button
        className="collection-remove"
        title="取消收藏"
        onClick={() => void unsubscribe(Number(item.id))}
      >
        <Heart size={15} fill="currentColor" />
      </button>
    </article>
  );
}

function CollectionCover({
  src,
  icon,
  round = false,
}: {
  src: string;
  icon: ReactNode;
  round?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`card-cover collection-cover ${round ? "round" : ""}`}>
      {src && !failed ? (
        <img
          src={sizedImage(src, 360)}
          alt=""
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="collection-cover-placeholder">{icon}</span>
      )}
    </div>
  );
}

export default function CollectionPage() {
  const category = useCollectionStore((state) => state.category);
  const albums = useCollectionStore((state) => state.albums);
  const artists = useCollectionStore((state) => state.artists);
  const media = useCollectionStore((state) => state.media);
  const radios = useCollectionStore((state) => state.radios);
  const total = useCollectionStore((state) => state.total);
  const loading = useCollectionStore((state) => state.loading);
  const loadingMore = useCollectionStore((state) => state.loadingMore);
  const hasMore = useCollectionStore((state) => state.hasMore);
  const setCategory = useCollectionStore((state) => state.setCategory);
  const loadMore = useCollectionStore((state) => state.loadMore);
  const unsubscribe = useCollectionStore((state) => state.unsubscribe);
  const openAlbum = useCollectionStore((state) => state.openAlbum);
  const openArtist = useCollectionStore((state) => state.openArtist);
  const openRadio = useCollectionStore((state) => state.openRadio);
  const mediaItem = useCollectionStore((state) => state.mediaItem);
  const mediaUrl = useCollectionStore((state) => state.mediaUrl);
  const mediaLoading = useCollectionStore((state) => state.mediaLoading);
  const closeMedia = useCollectionStore((state) => state.closeMedia);
  const loadMoreRef = useInfiniteScroll(
    () => void loadMore(),
    loadingMore || !hasMore,
  );

  // 空状态按当前分类判断：任一其他分类有数据不代表当前分类非空。
  const currentItems =
    category === "albums"
      ? albums.length
      : category === "artists"
        ? artists.length
        : category === "mvs"
          ? media.length
          : radios.length;
  return (
    <Page>
      <BackButton />
      <PageHeader title="收藏中心" subtitle={`${total} 项收藏内容`} />
      <div className="collection-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={category === tab.id}
            className={category === tab.id ? "active" : ""}
            onClick={() => void setCategory(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {loading ? (
        <LoadingState label="正在加载收藏…" />
      ) : currentItems === 0 ? (
        <div className="empty">暂无收藏内容</div>
      ) : (
        <>
          {category === "albums" && (
            <div className="media-grid collection-grid">
              {albums.map((album) => (
                <article
                  className="media-card collection-card"
                  key={album.id}
                  onClick={() => void openAlbum(album)}
                >
                  <CollectionCover
                    src={album.picUrl}
                    icon={<Disc3 size={30} />}
                  />
                  <strong>{album.name}</strong>
                  <span>{album.artistNames || "未知歌手"}</span>
                  <button
                    className="collection-remove"
                    title="取消收藏"
                    onClick={(event) => {
                      event.stopPropagation();
                      void unsubscribe(album.id);
                    }}
                  >
                    <Heart size={15} fill="currentColor" />
                  </button>
                </article>
              ))}
            </div>
          )}
          {category === "artists" && (
            <div className="media-grid collection-grid">
              {artists.map((artist) => (
                <article
                  className="media-card collection-card"
                  key={artist.id}
                  onClick={() => void openArtist(artist)}
                >
                  <CollectionCover
                    src={artist.picUrl}
                    icon={<UserRound size={30} />}
                    round
                  />
                  <strong>{artist.name}</strong>
                  <span>{artist.alias.join(" / ") || "歌手"}</span>
                  <button
                    className="collection-remove"
                    title="取消收藏"
                    onClick={(event) => {
                      event.stopPropagation();
                      void unsubscribe(artist.id);
                    }}
                  >
                    <Heart size={15} fill="currentColor" />
                  </button>
                </article>
              ))}
            </div>
          )}
          {category === "mvs" && (
            <div className="media-grid collection-grid">
              {media.map((item) => (
                <MediaCard key={item.id} item={item} />
              ))}
            </div>
          )}
          {category === "radios" && (
            <div className="media-grid collection-grid">
              {radios.map((radio) => (
                <article
                  className="media-card collection-card"
                  key={radio.id}
                  onClick={() => void openRadio(radio)}
                >
                  <CollectionCover
                    src={radio.picUrl}
                    icon={<Podcast size={30} />}
                  />
                  <strong>{radio.name}</strong>
                  <span>{radio.djName || radio.category || "播客"}</span>
                  <button
                    className="collection-remove"
                    title="取消订阅"
                    onClick={(event) => {
                      event.stopPropagation();
                      void unsubscribe(radio.id);
                    }}
                  >
                    <Heart size={15} fill="currentColor" />
                  </button>
                </article>
              ))}
            </div>
          )}
          {hasMore && <div ref={loadMoreRef} className="load-more-sentinel" />}
        </>
      )}
      {mediaItem && (
        <div className="search-media-overlay" onClick={closeMedia}>
          <div
            className="search-media-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            {mediaLoading ? (
              <LoadingState label="正在准备 MV…" />
            ) : mediaUrl ? (
              <video src={mediaUrl} controls autoPlay />
            ) : null}
            <div className="search-media-heading">
              <div>
                <strong>{mediaItem.name}</strong>
                <span>{mediaItem.creatorName}</span>
              </div>
              <button title="关闭" onClick={closeMedia}>
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
