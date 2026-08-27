import { useEffect } from "react";
import {
  Check,
  Copy,
  Link2,
  Pause,
  Play,
  RefreshCw,
  Square,
  Users,
  X,
} from "lucide-react";
import { useListenTogetherStore } from "../store/listenTogetherStore.ts";
import { usePlayerStore } from "../store/playerStore.ts";
import { sizedImage } from "../utils/image";
import { LoadingState, Page, PageHeader } from "./Page";

export default function ListenTogetherPage({ modal = false, onClose }: { modal?: boolean; onClose?: () => void }) {
  const room = useListenTogetherStore((state) => state.room);
  const playlist = useListenTogetherStore((state) => state.playlist);
  const roomIdInput = useListenTogetherStore((state) => state.roomIdInput);
  const inviterIdInput = useListenTogetherStore(
    (state) => state.inviterIdInput,
  );
  const loading = useListenTogetherStore((state) => state.loading);
  const syncing = useListenTogetherStore((state) => state.syncing);
  const error = useListenTogetherStore((state) => state.error);
  const setRoomIdInput = useListenTogetherStore(
    (state) => state.setRoomIdInput,
  );
  const setInviterIdInput = useListenTogetherStore(
    (state) => state.setInviterIdInput,
  );
  const createRoom = useListenTogetherStore((state) => state.createRoom);
  const checkRoom = useListenTogetherStore((state) => state.checkRoom);
  const joinRoom = useListenTogetherStore((state) => state.joinRoom);
  const refresh = useListenTogetherStore((state) => state.refresh);
  const syncPlaylist = useListenTogetherStore((state) => state.syncPlaylist);
  const playSynchronizedSong = useListenTogetherStore(
    (state) => state.playSynchronizedSong,
  );
  const sendPlaybackCommand = useListenTogetherStore(
    (state) => state.sendPlaybackCommand,
  );
  const endRoom = useListenTogetherStore((state) => state.endRoom);
  const currentSong = usePlayerStore((state) => state.currentSong);
  const playing = usePlayerStore((state) => state.playing);
  const userId = usePlayerStore((state) => state.profile?.userId ?? 0);
  const isOwner = Boolean(room?.ownerId && room.ownerId === userId);

  useEffect(() => {
    if (!room) return;
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, [room, refresh]);

  const copyRoomId = async () => {
    if (!room?.roomId) return;
    try {
      await navigator.clipboard.writeText(room.roomId);
      usePlayerStore.getState().toast("房间号已复制", "success");
    } catch {
      usePlayerStore.getState().toast("复制失败，请手动复制", "error");
    }
  };

  const togglePlayback = async () => {
    const player = usePlayerStore.getState();
    player.togglePlay();
    const nextPlaying = usePlayerStore.getState().playing;
    await sendPlaybackCommand(nextPlaying ? "play" : "pause");
  };

  return (
    <Page>
      {modal && onClose ? <button className="sr-only" onClick={onClose} aria-label="关闭一起听" /> : null}
      <PageHeader
        title="一起听"
        subtitle="和好友共享房间、歌单与播放状态"
        actions={
          room ? (
            <button
              className="icon-button"
              title="刷新房间状态"
              onClick={() => void refresh()}
              disabled={syncing}
            >
              <RefreshCw size={17} className={syncing ? "spin" : undefined} />
            </button>
          ) : undefined
        }
      />

      {!room ? (
        <section className="listen-together-panel">
          <div className="listen-together-create">
            <div>
              <h2>创建房间</h2>
              <p>创建后把房间号分享给好友即可一起播放。</p>
            </div>
            <button
              className="primary-button"
              onClick={() => void createRoom()}
              disabled={loading}
            >
              {loading ? (
                <LoadingState label="创建中…" />
              ) : (
                <>
                  <Link2 size={16} />
                  创建房间
                </>
              )}
            </button>
          </div>
          <div className="listen-together-divider">
            <span>或加入已有房间</span>
          </div>
          <div className="listen-together-form">
            <label>
              <span>房间号</span>
              <input
                value={roomIdInput}
                onChange={(event) => setRoomIdInput(event.target.value)}
                placeholder="输入房间号"
                onKeyDown={(event) => {
                  if (event.key === "Enter") void checkRoom();
                }}
              />
            </label>
            <label>
              <span>邀请人 ID（可选）</span>
              <input
                value={inviterIdInput}
                onChange={(event) => setInviterIdInput(event.target.value)}
                inputMode="numeric"
                placeholder="房间信息中已有时可留空"
              />
            </label>
            <div className="listen-together-form-actions">
              <button
                className="secondary-button"
                onClick={() => void checkRoom()}
                disabled={loading}
              >
                <Check size={16} />
                检查房间
              </button>
              <button
                className="primary-button"
                onClick={() => void joinRoom()}
                disabled={loading}
              >
                <Users size={16} />
                加入房间
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="listen-together-panel listen-together-room">
            <div className="listen-together-room-head">
              <div>
                <span className="listen-together-kicker">房间号</span>
                <div className="listen-together-room-id">
                  <strong>{room.roomId}</strong>
                  <button
                    className="icon-button"
                    title="复制房间号"
                    onClick={() => void copyRoomId()}
                  >
                    <Copy size={15} />
                  </button>
                </div>
              </div>
              <div className="listen-together-member-count">
                <Users size={16} />
                {room.memberCount}/{room.maxMemberCount}
              </div>
            </div>
            <div className="listen-together-room-actions">
              <button
                className="secondary-button"
                onClick={() => void syncPlaylist()}
                disabled={syncing}
              >
                <RefreshCw size={16} />
                同步歌单
              </button>
              <button
                className="secondary-button"
                onClick={() => void togglePlayback()}
                disabled={!currentSong}
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}
                {playing ? "暂停并同步" : "播放并同步"}
              </button>
              {isOwner ? (
                <button
                  className="danger-button"
                  onClick={() => void endRoom()}
                  disabled={loading}
                >
                  <X size={16} />
                  结束房间
                </button>
              ) : (
                <button
                  className="danger-button"
                  onClick={() => useListenTogetherStore.getState().leaveRoom()}
                  disabled={loading}
                >
                  <X size={16} />
                  离开房间
                </button>
              )}
            </div>
          </section>

          <section className="listen-together-panel">
            <div className="listen-together-section-head">
              <div>
                <h2>同步歌单</h2>
                <span>{playlist.length} 首歌曲</span>
              </div>
              {currentSong && (
                <div className="listen-together-current">
                  <span>当前播放</span>
                  <strong>{currentSong.name}</strong>
                </div>
              )}
            </div>
            {syncing && playlist.length === 0 ? (
              <LoadingState label="正在同步歌单…" />
            ) : playlist.length === 0 ? (
              <div className="listen-together-empty">
                <Square size={18} />
                暂无同步歌曲
              </div>
            ) : (
              <div className="listen-together-playlist">
                {playlist.map((song, index) => (
                  <button
                    className={`listen-together-song ${currentSong?.id === song.id ? "active" : ""}`}
                    key={`${song.id}-${index}`}
                    onClick={() => void playSynchronizedSong(song)}
                  >
                    {song.picUrl ? (
                      <img src={sizedImage(song.picUrl, 80)} alt="" />
                    ) : (
                      <span className="song-ph">
                        <Square size={15} />
                      </span>
                    )}
                    <span className="listen-together-song-meta">
                      <strong>{song.name}</strong>
                      <small>
                        {song.artists} · {song.album}
                      </small>
                    </span>
                    {currentSong?.id === song.id && (
                      <span className="listen-together-playing">
                        {playing ? "播放中" : "已暂停"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}
      {error && (
        <div className="listen-together-error" role="alert">
          {error}
        </div>
      )}
    </Page>
  );
}
