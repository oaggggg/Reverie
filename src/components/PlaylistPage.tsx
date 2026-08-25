import { useEffect, useState } from "react";
import { Check, Heart, ListPlus, MessageCircle, Pencil, RefreshCw, Trash2 } from "lucide-react";
import type { PlaylistInfo } from "../api/types";
import type { Song } from "../api/types";
import { getPlaylistDetail } from "../api/client";
import { getRelatedPlaylists } from "../api/related";
import {
  getPlaylistDynamicStats,
  getPlaylistSubscribers,
  getPlaylistAllTracks,
  markPlaylistPlayed,
  manipulatePlaylistTracks,
  updatePlaylistOrder,
} from "../api/playlist";
import { useExploreStore } from "../store/exploreStore";
import { usePlayerStore } from "../store/playerStore";
import { useCommentStore } from "../store/commentStore";
import type { PlaylistDynamicStats, SocialUser } from "../api/types";
import { sizedImage } from "../utils/image";
import { Page, PageHeader } from "./Page";
import SongList from "./SongList";
import PlaylistEditorModal from "./PlaylistEditorModal";
import BackButton from "./BackButton";
import ConfirmModal from "./ConfirmModal";
import PlaylistTrackPicker from "./PlaylistTrackPicker";
import PlaylistGrid from "./PlaylistGrid";

export default function PlaylistPage() {
  const playlistSongs = usePlayerStore((s) => s.playlistSongs);
  const playlistName = usePlayerStore((s) => s.playlistName);
  const playlistId = usePlayerStore((s) => s.playlistId);
  const playlistDescription = usePlayerStore((s) => s.playlistDescription);
  const playlistCreatorId = usePlayerStore((s) => s.playlistCreatorId);
  const playlistSubscribed = usePlayerStore((s) => s.playlistSubscribed);
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
  const [checkingIn, setCheckingIn] = useState(false);
  const [dynamicStats, setDynamicStats] = useState<PlaylistDynamicStats | null>(null);
  const [relatedPlaylists, setRelatedPlaylists] = useState<PlaylistInfo[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [subscribers, setSubscribers] = useState<SocialUser[]>([]);
  const [subscribersLoading, setSubscribersLoading] = useState(false);
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
    setSubscribersLoading(true);
    void getPlaylistSubscribers(playlistId)
      .then((items) => {
        if (alive) setSubscribers(items);
      })
      .catch(() => {
        if (alive) setSubscribers([]);
      })
      .finally(() => {
        if (alive) setSubscribersLoading(false);
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
    const detail = await getPlaylistDetail(playlistId);
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
      if (!songs.length) {
        usePlayerStore.getState().toast("歌单暂无可用歌曲", "error");
        return;
      }
      usePlayerStore.setState({ playlistSongs: songs });
      usePlayerStore.getState().toast(`已加载完整歌曲列表（${songs.length} 首）`, "success");
    } catch {
      usePlayerStore.getState().toast("加载完整歌曲列表失败", "error");
    } finally {
      setFullLoading(false);
    }
  };

  const checkIn = async () => {
    if (!playlistId || checkingIn) return;
    setCheckingIn(true);
    try {
      await markPlaylistPlayed(playlistId);
      const stats = await getPlaylistDynamicStats(playlistId);
      setDynamicStats(stats);
      usePlayerStore.getState().toast("歌单打卡成功", "success");
    } catch {
      usePlayerStore.getState().toast("歌单打卡失败", "error");
    } finally {
      setCheckingIn(false);
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
  const playlist: PlaylistInfo = {
    id: playlistId,
    name: playlistName,
    coverImgUrl: "",
    trackCount: playlistSongs.length,
    description: playlistDescription,
    creatorId: playlistCreatorId,
    subscribed: playlistSubscribed,
  };
  const owned = playlistCreatorId > 0 && playlistCreatorId === uid;
  const playlistActions = !playlistLoading && playlistId > 0 ? (
    <div className="page-action-row">
      <button className="btn" onClick={() => void checkIn()} disabled={checkingIn} title="记录歌单播放">
        <Check size={14} /> {checkingIn ? "打卡中…" : "打卡"}
      </button>
      <button className="btn" onClick={() => void loadFullSongs()} disabled={fullLoading} title="从网易云加载歌单全部歌曲">
        <RefreshCw size={14} className={fullLoading ? "spin" : ""} /> 完整列表
      </button>
      <button
        className="btn"
        onClick={() =>
          void openComments(
            {
              type: "playlist",
              id: String(playlistId),
              title: playlistName || "歌单",
              subtitle: `${playlistSongs.length} 首歌曲`,
            },
            true,
          )
        }
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
    </div>
  ) : null;

  return (
    <Page>
      <BackButton onClick={closePlaylist} />
      <PageHeader
        title={playlistName || "歌单"}
        subtitle={playlistDescription || `${playlistSongs.length} 首`}
        actions={playlistActions}
      />
      {dynamicStats && (
        <div className="playlist-dynamic-stats" aria-label="歌单动态统计">
          <span>播放 {dynamicStats.playCount.toLocaleString("zh-CN")}</span>
          <span>收藏 {dynamicStats.subscribedCount.toLocaleString("zh-CN")}</span>
          <span>评论 {dynamicStats.commentCount.toLocaleString("zh-CN")}</span>
          <span>分享 {dynamicStats.shareCount.toLocaleString("zh-CN")}</span>
        </div>
      )}
      {(subscribersLoading || subscribers.length > 0) && (
        <section className="playlist-subscribers">
          <div className="list-header">
            <h3>收藏者</h3>
            <span className="count">{subscribersLoading ? "加载中…" : `${subscribers.length} 人`}</span>
          </div>
          <div className="playlist-subscriber-list">
            {subscribers.map((user) => (
              <div className="playlist-subscriber" key={user.userId} title={user.signature || user.nickname}>
                {user.avatarUrl ? <img src={sizedImage(user.avatarUrl, 80)} alt="" loading="lazy" /> : <span>{user.nickname.slice(0, 1)}</span>}
                <strong>{user.nickname}</strong>
              </div>
            ))}
          </div>
        </section>
      )}
      <SongList
        songs={playlistSongs}
        loading={playlistLoading}
        emptyText="歌单为空"
        onRemove={owned ? (song) => void removeSong(song) : undefined}
        onMove={
          owned
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
