import { useEffect, useState } from "react";
import { AudioLines, Heart, MessageCircle, UserRound } from "lucide-react";
import { getAlbumPrivileges } from "../api/library";
import type { AlbumPrivilege } from "../api/types";
import { useCommentStore } from "../store/commentStore";
import { useExploreStore } from "../store/exploreStore";
import { sizedImage } from "../utils/image";
import { LoadingState, Page } from "./Page";
import SongList from "./SongList";
import BackButton from "./BackButton";

export default function AlbumPage() {
  const album = useExploreStore((s) => s.album);
  const songs = useExploreStore((s) => s.albumSongs);
  const loading = useExploreStore((s) => s.loading);
  const toggleSubscription = useExploreStore((s) => s.toggleAlbumSubscription);
  const openArtist = useExploreStore((s) => s.openArtist);
  const openComments = useCommentStore((s) => s.openResourceComments);
  const [privileges, setPrivileges] = useState<AlbumPrivilege[]>([]);

  useEffect(() => {
    let alive = true;
    if (!album?.id) {
      setPrivileges([]);
      return;
    }
    void getAlbumPrivileges(album.id)
      .then((items) => {
        if (alive) setPrivileges(items);
      })
      .catch(() => {
        if (alive) setPrivileges([]);
      });
    return () => {
      alive = false;
    };
  }, [album?.id]);

  const highResCount = privileges.filter((item) => item.highRes).length;
  const losslessCount = privileges.filter((item) => item.lossless).length;

  return (
    <Page>
      {!album ? (
        loading ? (
          <LoadingState label="正在加载专辑…" />
        ) : (
          <div className="empty">专辑不存在</div>
        )
      ) : (
        <>
          <BackButton />
          <section className="detail-hero">
            <img
              className="detail-cover"
              src={sizedImage(album.picUrl, 480)}
              alt=""
            />
            <div className="detail-copy">
              <span className="detail-kind">专辑</span>
              <h1>{album.name}</h1>
              <button
                className="detail-link"
                disabled={!album.artistIds[0]}
                onClick={() =>
                  album.artistIds[0] && void openArtist(album.artistIds[0])
                }
              >
                <UserRound size={15} /> {album.artistNames || "未知歌手"}
              </button>
              <p>{album.description || "暂无专辑介绍"}</p>
              <div className="detail-meta">
                <span>{album.size || songs.length} 首</span>
                {album.publishTime > 0 && (
                  <span>
                    {new Date(album.publishTime).toLocaleDateString()}
                  </span>
                )}
                {privileges.length > 0 && (
                  <span
                    className="album-quality-summary"
                    title="专辑歌曲可用音质"
                  >
                    <AudioLines size={13} />
                    {highResCount > 0
                      ? `Hi-Res ${highResCount}`
                      : `无损 ${losslessCount}`}
                  </span>
                )}
              </div>
              <div className="detail-actions">
                <button
                  className={`btn ${album.subscribed ? "active" : "primary"}`}
                  onClick={() => void toggleSubscription()}
                >
                  <Heart
                    size={15}
                    fill={album.subscribed ? "currentColor" : "none"}
                  />
                  {album.subscribed ? "已收藏" : "收藏专辑"}
                </button>
                <button
                  className="btn"
                  onClick={() =>
                    void openComments(
                      {
                        type: "album",
                        id: String(album.id),
                        title: album.name,
                        subtitle: album.artistNames,
                        coverUrl: album.picUrl,
                      },
                      true,
                    )
                  }
                >
                  <MessageCircle size={15} /> 评论
                </button>
              </div>
            </div>
          </section>
          <SongList songs={songs} title="专辑歌曲" />
        </>
      )}
    </Page>
  );
}
