import { useEffect, useMemo, useRef, useState } from "react";
import {
  Heart,
  ListPlus,
  MessageCircle,
  Pencil,
  Play,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import type { PlaylistInfo } from "../api/types";
import type { Song } from "../api/types";
import { getPlaylistDetail } from "../api/client";
import { getRelatedPlaylists } from "../api/related";
import {
  getPlaylistDynamicStats,
  getPlaylistAllTracks,
  manipulatePlaylistTracks,
  updatePlaylistOrder,
} from "../api/playlist";
import { useExploreStore } from "../store/exploreStore";
import { usePlayerStore } from "../store/playerStore";
import { useCommentStore } from "../store/commentStore";
import type { PlaylistDynamicStats } from "../api/types";
import { sizedImage } from "../utils/image";
import { Page } from "./Page";
import SongList from "./SongList";
import PlaylistEditorModal from "./PlaylistEditorModal";
import BackButton from "./BackButton";
import ConfirmModal from "./ConfirmModal";
import PlaylistTrackPicker from "./PlaylistTrackPicker";
import PlaylistGrid from "./PlaylistGrid";
import CommentPanel from "./CommentPanel";
import { useModalBehavior } from "../utils/modalBehavior";
import { captureInteractionOrigin, useOriginTransition } from "../utils/originTransition";

export default function PlaylistPage() {
  const playlistSongs = usePlayerStore((s) => s.playlistSongs);
  const playlistName = usePlayerStore((s) => s.playlistName);
  const playlistId = usePlayerStore((s) => s.playlistId);
  const playlistDescription = usePlayerStore((s) => s.playlistDescription);
  const playlistCover = usePlayerStore((s) => s.playlistCover);
  const playlistCreatorId = usePlayerStore((s) => s.playlistCreatorId);
  const playlistSubscribed = usePlayerStore((s) => s.playlistSubscribed);
  const firstUserPlaylistId = usePlayerStore((s) => s.userPlaylists[0]?.id ?? 0);
  const playlistLoading = usePlayerStore((s) => s.playlistLoading);
  const uid = usePlayerStore((s) => s.profile?.userId ?? 0);
  const closePlaylist = usePlayerStore((s) => s.closePlaylist);
  const deletePlaylist = useExploreStore((s) => s.deletePlaylist);
  const toggleSubscription = useExploreStore(
    (s) => s.togglePlaylistSubscription,
  );
  const openComments = useCommentStore((s) => s.openResourceComments);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [fullLoading, setFullLoading] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const commentsSurfaceRef = useRef<HTMLDivElement>(null);
  const commentsTransition = useOriginTransition(commentsOpen, "playlist-comments", 220);
  useModalBehavior(commentsOpen, commentsSurfaceRef, () =>
    setCommentsOpen(false),
  );
  const [dynamicStats, setDynamicStats] = useState<PlaylistDynamicStats | null>(
    null,
  );
  const [relatedPlaylists, setRelatedPlaylists] = useState<PlaylistInfo[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const openPlaylist = usePlayerStore((s) => s.openPlaylist);

  useEffect(() => {
    let alive = true;
    setDynamicStats(null);
    setRelatedPlaylists([]);
    if (!playlistId) return;
    void getPlaylistDynamicStats(playlistId)
      .then((stats) => {
        if (alive) setDynamicStats(stats);
      })
      .catch(() => {
        if (alive) setDynamicStats(null);
      });
    return () => {
      alive = false;
    };
  }, [playlistId]);

  useEffect(() => {
    let alive = true;
    if (!playlistId) return;
    setRelatedLoading(true);
    void getRelatedPlaylists(playlistId)
      .then((items) => {
        if (alive) setRelatedPlaylists(items.slice(0, 12));
      })
      .catch(() => {
        if (alive) setRelatedPlaylists([]);
      })
      .finally(() => {
        if (alive) setRelatedLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [playlistId]);

  const refreshSongs = async () => {
    const targetId = playlistId;
    const detail = await getPlaylistDetail(targetId);
    // 请求期间用户可能已切换到其他歌单，慢响应不得覆盖新歌单。
    if (usePlayerStore.getState().playlistId !== targetId) return;
    usePlayerStore.setState({
      playlistSongs: detail.songs,
      playlistName: detail.name,
      playlistDescription: detail.description,
      playlistCreatorId: detail.creatorId,
      playlistSubscribed: detail.subscribed,
    });
  };

  const loadFullSongs = async () => {
    if (!playlistId || fullLoading) return;
    setFullLoading(true);
    try {
      const songs = await getPlaylistAllTracks(playlistId);
      if (usePlayerStore.getState().playlistId !== playlistId) return;
      if (!songs.length) {
        usePlayerStore.getState().toast("歌单暂无可用歌曲", "error");
        return;
      }
      usePlayerStore.setState({ playlistSongs: songs });
      usePlayerStore
        .getState()
        .toast(`已加载完整歌曲列表（${songs.length} 首）`, "success");
    } catch {
      usePlayerStore.getState().toast("加载完整歌曲列表失败", "error");
    } finally {
      setFullLoading(false);
    }
  };

  const addSongs = async (songs: Song[]) => {
    setMutating(true);
    try {
      await manipulatePlaylistTracks(
        playlistId,
        "add",
        songs.map((song) => song.id),
      );
      await refreshSongs();
      usePlayerStore
        .getState()
        .toast(`已添加 ${songs.length} 首歌曲`, "success");
      return true;
    } catch {
      usePlayerStore.getState().toast("添加歌曲失败", "error");
      return false;
    } finally {
      setMutating(false);
    }
  };

  const removeSong = async (song: Song) => {
    if (mutating) return;
    setMutating(true);
    try {
      await manipulatePlaylistTracks(playlistId, "del", [song.id]);
      usePlayerStore.setState({
        playlistSongs: playlistSongs.filter((item) => item.id !== song.id),
      });
      usePlayerStore.getState().toast("已从歌单移除", "success");
    } catch {
      usePlayerStore.getState().toast("移除歌曲失败", "error");
    } finally {
      setMutating(false);
    }
  };

  const moveSong = async (song: Song, index: number, direction: -1 | 1) => {
    if (mutating) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= playlistSongs.length) return;
    const reordered = [...playlistSongs];
    const [item] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, item!);
    usePlayerStore.setState({ playlistSongs: reordered });
    setMutating(true);
    try {
      await updatePlaylistOrder(
        playlistId,
        reordered.map((entry) => entry.id),
      );
    } catch {
      usePlayerStore.setState({ playlistSongs });
      usePlayerStore.getState().toast(`调整「${song.name}」顺序失败`, "error");
    } finally {
      setMutating(false);
    }
  };
  // useMemo 稳定对象身份：异步请求触发的重渲染不会生成新引用，
  // 否则编辑弹窗的回填 effect 会反复执行并清空用户正在输入的表单。
  const playlist = useMemo<PlaylistInfo>(
    () => ({
      id: playlistId,
      name: playlistName,
      coverImgUrl: "",
      trackCount: playlistSongs.length,
      description: playlistDescription,
      creatorId: playlistCreatorId,
      subscribed: playlistSubscribed,
    }),
    [
      playlistId,
      playlistName,
      playlistSongs.length,
      playlistDescription,
      playlistCreatorId,
      playlistSubscribed,
    ],
  );
  const owned = playlistCreatorId > 0 && playlistCreatorId === uid;
  const isLikedPlaylist = playlistId > 0 && playlistId === firstUserPlaylistId;
  const canManage = owned && !isLikedPlaylist;
  const playlistActions =
    !playlistLoading && playlistId > 0 ? (
      <>
        <button
          className="btn primary"
          onClick={() => {
            if (playlistSongs.length) {
              void usePlayerStore
                .getState()
                .playSong(playlistSongs[0], playlistSongs);
            }
          }}
          disabled={!playlistSongs.length}
          title="播放歌单中的全部歌曲"
        >
          <Play size={14} fill="currentColor" /> 播放全部
        </button>
        <button
          className="btn"
          onClick={() => void loadFullSongs()}
          disabled={fullLoading}
          title="从网易云加载歌单全部歌曲"
        >
          <RefreshCw size={14} className={fullLoading ? "spin" : ""} /> 完整列表
        </button>
        <button
          className="btn"
          onClick={(event) => {
            captureInteractionOrigin("playlist-comments", event.currentTarget);
            setCommentsOpen(true);
            void openComments(
              {
                type: "playlist",
                id: String(playlistId),
                title: playlistName || "歌单",
                subtitle: `${playlistSongs.length} 首歌曲`,
                coverUrl: playlistCover,
              },
              false,
            );
          }}
        >
          <MessageCircle size={14} /> 评论
        </button>
        {owned ? (
          <>
            <button
              className="btn primary"
              onClick={() => setPickerOpen(true)}
              disabled={mutating}
            >
              <ListPlus size={14} /> 添加歌曲
            </button>
            {canManage ? (
              <>
                <button className="btn" onClick={() => setEditing(true)}>
                  <Pencil size={14} /> 编辑
                </button>
                <button
                  className="btn danger"
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2 size={14} /> 删除
                </button>
              </>
            ) : null}
          </>
        ) : (
          <button
            className={`btn ${playlistSubscribed ? "active" : "primary"}`}
            onClick={() => void toggleSubscription(playlist)}
          >
            <Heart
              size={14}
              fill={playlistSubscribed ? "currentColor" : "none"}
            />
            {playlistSubscribed ? "已收藏" : "收藏歌单"}
          </button>
        )}
      </>
    ) : null;

  return (
    <Page>
      <BackButton onClick={closePlaylist} />
      {/* 与专辑/电台详情页统一的 detail-hero 布局 */}
      <section
        className={`detail-hero${playlistCover ? "" : " no-cover"}`}
        aria-label="歌单信息"
      >
        {playlistCover ? (
          <img
            className="detail-cover"
            src={sizedImage(playlistCover, 480)}
            alt=""
          />
        ) : null}
        <div className="detail-copy">
          <span className="detail-kind">歌单</span>
          <h1>{playlistName || "歌单"}</h1>
          <p>{playlistDescription || `${playlistSongs.length} 首歌曲`}</p>
          <div className="detail-meta">
            <span>{playlistSongs.length} 首</span>
            {dynamicStats && (
              <span>播放 {dynamicStats.playCount.toLocaleString("zh-CN")}</span>
            )}
            {dynamicStats && (
              <span>
                收藏 {dynamicStats.subscribedCount.toLocaleString("zh-CN")}
              </span>
            )}
            {dynamicStats && (
              <span>
                评论 {dynamicStats.commentCount.toLocaleString("zh-CN")}
              </span>
            )}
            {dynamicStats && (
              <span>
                分享 {dynamicStats.shareCount.toLocaleString("zh-CN")}
              </span>
            )}
          </div>
          <div className="detail-actions">{playlistActions}</div>
        </div>
      </section>
      <SongList
        songs={playlistSongs}
        title="歌曲列表"
        loading={playlistLoading}
        emptyText="歌单为空"
        onRemove={canManage ? (song) => void removeSong(song) : undefined}
        onMove={
          canManage
            ? (song, index, direction) => void moveSong(song, index, direction)
            : undefined
        }
      />
      {(relatedLoading || relatedPlaylists.length > 0) && (
        <section className="related-section">
          <div className="list-header">
            <h3>相似歌单</h3>
            <span className="count">{relatedPlaylists.length} 个</span>
          </div>
          <PlaylistGrid
            playlists={relatedPlaylists}
            onOpen={openPlaylist}
            loading={relatedLoading}
            emptyText="暂无相似歌单"
          />
        </section>
      )}
      <PlaylistTrackPicker
        open={pickerOpen}
        existingIds={new Set(playlistSongs.map((song) => song.id))}
        onClose={() => setPickerOpen(false)}
        onSubmit={addSongs}
      />
      <PlaylistEditorModal
        playlist={playlist}
        open={editing}
        onClose={() => setEditing(false)}
      />
      {commentsTransition.rendered && (
        <div className={`modal-backdrop ${commentsTransition.backdropClassName}`} onClick={() => setCommentsOpen(false)}>
          <section
            ref={commentsSurfaceRef}
            className={`modal comments-modal playlist-comments-modal ${commentsTransition.surfaceClassName}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="playlist-comments-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="comments-modal-header">
              {playlistCover ? (
                <img
                  className="playlist-comments-cover"
                  src={sizedImage(playlistCover, 120)}
                  alt=""
                />
              ) : null}
              <div className="comments-modal-title-block">
                <span>歌单评论</span>
                <strong id="playlist-comments-title">
                  {playlistName || "歌单"}
                </strong>
              </div>
              <button
                className="icon-btn"
                title="关闭"
                onClick={() => setCommentsOpen(false)}
              >
                <X size={18} />
              </button>
            </header>
            <div className="comments-modal-body">
              <CommentPanel compact />
            </div>
          </section>
        </div>
      )}
      <ConfirmModal
        open={confirmingDelete}
        title="删除歌单"
        message={`确定删除「${playlistName || "这个歌单"}」吗？删除后无法恢复。`}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={() => deletePlaylist(playlist)}
      />
    </Page>
  );
}
