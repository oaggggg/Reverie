import { useEffect, useRef, useState } from "react";
import { getDynamicSongCover, getSongLikeStatus } from "../api/songStatus";
import { PLAYBACK_QUALITY_LABELS, usePlayerStore } from "../store/playerStore";
import { formatTime } from "../utils/lyrics";
import { sizedImage } from "../utils/image";
import { captureCoverOrigin } from "../utils/sharedCoverTransition";
import {
  captureInteractionOrigin,
  useOriginTransition,
} from "../utils/originTransition";
import { preloadNowPlayingAssets, warmCoverImage } from "../utils/nowPlayingPreload";
import type { PlayMode } from "../api/types";
import ShareResourceDialog from "./ShareResourceDialog";
import {
  Heart,
  ListMusic,
  MessageCircleMore,
  Pause,
  Play,
  RadioTower,
  Repeat,
  Repeat1,
  Shuffle,
  Share,
  SkipBack,
  SkipForward,
  Turntable,
  Volume2,
  VolumeX,
} from "lucide-react";

const MODE_LABEL: Record<PlayMode, string> = {
  sequence: "顺序播放",
  one: "单曲循环",
  shuffle: "随机播放",
};

const PLAYER_FOCUS_SCOPE_SELECTOR = [
  ".player-bar",
  ".pb-queue-menu",
  ".pb-quality-menu",
  ".player-comments-drawer",
  ".share-dialog",
  ".np-visual-panel",
].join(",");

function ModeIcon({ mode }: { mode: PlayMode }) {
  if (mode === "shuffle") return <Shuffle size={18} />;
  if (mode === "one") return <Repeat1 size={18} />;
  return <Repeat size={18} />;
}

export default function PlayerBar() {
  const [failedCover, setFailedCover] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [dynamicCover, setDynamicCover] = useState("");
  const [remoteLiked, setRemoteLiked] = useState<boolean | null>(null);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.index);
  const playQueueAt = usePlayerStore((s) => s.playQueueAt);
  const menuRef = useRef<HTMLDivElement>(null);
  const qualityTransition = useOriginTransition<HTMLDivElement>(
    qualityOpen,
    "player-quality",
    160,
  );
  const queueTransition = useOriginTransition<HTMLDivElement>(
    queueOpen,
    "player-queue",
    180,
  );
  const volumeTransition = useOriginTransition<HTMLDivElement>(
    volumeOpen,
    "player-volume",
    180,
  );
  const volWrapRef = useRef<HTMLDivElement | null>(null);

  // React 对 wheel 采用 passive 监听，onWheel 里 preventDefault 无效；
  // 改用原生非 passive 监听，滚轮调音量时不再连带滚动页面。
  useEffect(() => {
    const el = volWrapRef.current;
    if (!el) return;
    const handler = (event: WheelEvent) => {
      event.preventDefault();
      const s = usePlayerStore.getState();
      s.setVolume((s.muted ? 0 : s.volume) + (event.deltaY < 0 ? 0.02 : -0.02));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const previewEnd = usePlayerStore((s) => s.previewEnd);
  const playing = usePlayerStore((s) => s.playing);
  const loadingUrl = usePlayerStore((s) => s.loadingUrl);
  const progress = usePlayerStore((s) => s.progress);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const playMode = usePlayerStore((s) => s.playMode);
  const likedIds = usePlayerStore((s) => s.likedIds);
  const queueSource = usePlayerStore((s) => s.queueSource);
  const coverQuality = usePlayerStore((s) => s.coverQuality);
  const showPlayerComments = usePlayerStore((s) => s.showPlayerComments);
  const playbackQuality = usePlayerStore((s) => s.playbackQuality);
  const availablePlaybackQualities = usePlayerStore(
    (s) => s.availablePlaybackQualities,
  );
  const qualitySwitching = usePlayerStore((s) => s.qualitySwitching);

  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const seek = usePlayerStore((s) => s.seek);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const cyclePlayMode = usePlayerStore((s) => s.cyclePlayMode);
  const setPage = usePlayerStore((s) => s.setPage);
  const toggleLike = usePlayerStore((s) => s.toggleLike);
  const loadPersonalFm = usePlayerStore((s) => s.loadPersonalFm);
  const setShowPlayerComments = usePlayerStore((s) => s.setShowPlayerComments);
  const toast = usePlayerStore((s) => s.toast);
  const loggedIn = usePlayerStore((s) => s.loggedIn);
  const setPlaybackQuality = usePlayerStore((s) => s.setPlaybackQuality);

  useEffect(() => {
    let alive = true;
    setDynamicCover("");
    setRemoteLiked(null);
    if (!currentSong) return;
    // 预热播放栏 120px 缩略图：切歌瞬间 <img> 换 src 时直接命中缓存，
    // 配合下方不重建元素的写法，封面不再闪动。
    warmCoverImage(currentSong.picUrl, 120);
    // 预热队列中的下一曲，提前把它的封面拉进缓存。
    const nextSong = queue[queueIndex + 1];
    if (nextSong && nextSong.id !== currentSong.id) {
      warmCoverImage(nextSong.picUrl, 120);
    }
    void getDynamicSongCover(currentSong.id)
      .then((url) => {
        if (alive && url) setDynamicCover(url);
      })
      .catch(() => {});
    if (loggedIn) {
      void getSongLikeStatus([currentSong.id])
        .then((status) => {
          if (alive && currentSong.id in status)
            setRemoteLiked(status[currentSong.id]!);
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [currentSong?.id, loggedIn]);

  useEffect(() => {
    if (!qualityOpen && !queueOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setQualityOpen(false);
        setQueueOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [qualityOpen, queueOpen]);

  useEffect(() => {
    if (!showPlayerComments) return;
    setQueueOpen(false);
    setQualityOpen(false);
    setShareOpen(false);
  }, [showPlayerComments]);

  useEffect(() => {
    let frame = 0;
    const clearFocus = () => {
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        active.closest(PLAYER_FOCUS_SCOPE_SELECTOR)
      ) {
        active.blur();
      }
    };
    const scheduleClearFocus = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(clearFocus);
    };

    document.addEventListener("pointerdown", scheduleClearFocus, true);
    document.addEventListener("pointerup", scheduleClearFocus, true);
    document.addEventListener("pointercancel", scheduleClearFocus, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", scheduleClearFocus, true);
      document.removeEventListener("pointerup", scheduleClearFocus, true);
      document.removeEventListener("pointercancel", scheduleClearFocus, true);
    };
  }, []);

  const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;
  const liked = currentSong
    ? (remoteLiked ?? likedIds.includes(currentSong.id))
    : false;
  const coverUrl = dynamicCover || currentSong?.picUrl || "";
  const showCover = Boolean(
    currentSong && coverUrl && failedCover !== coverUrl,
  );

  return (
    <>
      <footer className="player-bar">
        {/* progress row inside the pill, with time at both ends */}
        <div className="pb-progress">
          <span className="pb-time">{formatTime(progress)}</span>
          <input
            className="slider pb-slider"
            type="range"
            min={0}
            max={duration || 0}
            value={progress}
            style={{ ["--val" as never]: `${pct}%` }}
            onChange={(e) => seek(Number(e.target.value))}
          />
          <span className="pb-time">{formatTime(duration)}</span>
        </div>

        <div className="pb-row">
          <div className="pb-left">
            <div
              className={`pb-cover ${playing ? "spinning" : "paused"}`}
              onPointerEnter={() => {
                preloadNowPlayingAssets(
                  currentSong?.picUrl,
                  coverQuality !== "image",
                );
              }}
              onClick={(event) => {
                captureCoverOrigin(event.currentTarget);
                setPage("nowplaying");
              }}
              title="打开播放页"
              style={{ cursor: "pointer" }}
            >
              {showCover && currentSong ? (
                /* 故意不设 key：切歌时复用同一个 <img> 元素原地换 src，
                   浏览器会保留旧封面直到新图解码完成，不会闪一下；
                   加 key 会强制卸载重挂，加载期露出占位底色。 */
                <img
                  src={sizedImage(coverUrl, 120)}
                  alt=""
                  decoding="async"
                  onError={() => setFailedCover(coverUrl)}
                />
              ) : (
                <div className="pb-cover-ph">
                  <Turntable size={21} />
                </div>
              )}
            </div>
            <div className="pb-info">
              <div className="t">
                <span className="pb-title">
                  {currentSong?.name ?? "未在播放"}
                </span>
                {currentSong?.fee === 1 && (
                  <span className="vip-badge">VIP</span>
                )}
                {previewEnd !== null && (
                  <span className="preview-badge" title="当前为 60 秒试听">
                    试听
                  </span>
                )}
              </div>
              <div className="a">
                {currentSong?.artists ?? "选择一首歌开始播放"}
              </div>
            </div>
          </div>

          <div className="pb-controls">
            <button className="icon-btn" onClick={prev} title="上一首">
              <SkipBack size={19} />
            </button>
            <button
              className="icon-btn primary"
              onClick={togglePlay}
              title={playing ? "暂停" : "播放"}
            >
              {loadingUrl ? (
                <span className="spin-dot" />
              ) : playing ? (
                <Pause size={19} fill="currentColor" />
              ) : (
                <Play size={19} fill="currentColor" />
              )}
            </button>
            <button className="icon-btn" onClick={next} title="下一首">
              <SkipForward size={19} />
            </button>
            <button
              className="icon-btn active"
              onClick={cyclePlayMode}
              title={MODE_LABEL[playMode]}
            >
              <ModeIcon mode={playMode} />
            </button>
          </div>

          <div className="pb-right" ref={menuRef}>
            <div className="pb-queue-wrap">
              <button
                className={`icon-btn ${queueOpen ? "active" : ""}`}
                title="播放列表"
                aria-expanded={queueOpen}
                onClick={(event) => {
                  captureInteractionOrigin("player-queue", event.currentTarget);
                  setQueueOpen((open) => !open);
                  setQualityOpen(false);
                  setShareOpen(false);
                  setShowPlayerComments(false);
                }}
              >
                <ListMusic size={17} />
              </button>
              {queueTransition.rendered && (
                <div
                  ref={queueTransition.surfaceRef}
                  className={`pb-queue-menu ${queueTransition.surfaceClassName}`}
                  role="dialog"
                  aria-label="播放列表"
                >
                  <div className="pb-queue-head">
                    <strong>播放列表</strong>
                    <span>{queue.length} 首</span>
                  </div>
                  <div className="pb-queue-list">
                    {queue.length ? (
                      queue.map((song, index) => (
                        <button
                          key={`${song.id}-${index}`}
                          className={index === queueIndex ? "active" : ""}
                          onClick={() => {
                            void playQueueAt(index);
                            setQueueOpen(false);
                          }}
                        >
                          <span className="pb-queue-index">{index + 1}</span>
                          <span className="pb-queue-title">{song.name}</span>
                          <small>{song.artists}</small>
                        </button>
                      ))
                    ) : (
                      <div className="empty">暂无播放歌曲</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              className={`icon-btn ${queueSource === "fm" ? "active" : ""}`}
              onClick={() => void loadPersonalFm()}
              title="私人漫游"
            >
              <RadioTower size={17} />
            </button>
            <div className="pb-quality-wrap">
              <button
                className={`pb-quality-btn ${qualityOpen ? "active" : ""}`}
                onClick={(event) => {
                  captureInteractionOrigin(
                    "player-quality",
                    event.currentTarget,
                  );
                  setQualityOpen((open) => !open);
                  setQueueOpen(false);
                  setShareOpen(false);
                  setShowPlayerComments(false);
                }}
                title="音质"
                aria-haspopup="menu"
                aria-expanded={qualityOpen}
                aria-busy={qualitySwitching}
              >
                <span>{PLAYBACK_QUALITY_LABELS[playbackQuality]}</span>
              </button>
              {qualityTransition.rendered && (
                <div
                  ref={qualityTransition.surfaceRef}
                  className={`pb-quality-menu ${qualityTransition.surfaceClassName}`}
                  role="menu"
                >
                  {availablePlaybackQualities.map((quality) => (
                    <button
                      key={quality}
                      className={quality === playbackQuality ? "active" : ""}
                      role="menuitemradio"
                      aria-checked={quality === playbackQuality}
                      onClick={() => {
                        setQualityOpen(false);
                        void setPlaybackQuality(quality);
                      }}
                    >
                      <span>{PLAYBACK_QUALITY_LABELS[quality]}</span>
                      {quality === playbackQuality && (
                        <span aria-hidden="true">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className={`icon-btn ${showPlayerComments ? "active" : ""}`}
              onPointerEnter={() => void import("./PlayerCommentsDrawer")}
              onClick={(event) => {
                if (!currentSong) {
                  toast("请先播放一首歌曲", "info");
                  return;
                }
                captureInteractionOrigin(
                  "player-comments",
                  event.currentTarget,
                );
                setQueueOpen(false);
                setQualityOpen(false);
                setShareOpen(false);
                setShowPlayerComments(!showPlayerComments);
              }}
              title="歌曲评论"
            >
              <MessageCircleMore size={17} />
            </button>
            <button
              className={`icon-btn ${shareOpen ? "active" : ""}`}
              onClick={(event) => {
                if (!currentSong) {
                  toast("请先播放一首歌曲", "info");
                  return;
                }
                captureInteractionOrigin("player-share", event.currentTarget);
                setQueueOpen(false);
                setQualityOpen(false);
                setShowPlayerComments(false);
                setShareOpen((open) => !open);
              }}
              title="分享歌曲"
            >
              <Share size={17} />
            </button>
            <button
              className={`icon-btn ${liked ? "active" : ""}`}
              onClick={() => {
                setRemoteLiked(!liked);
                void toggleLike().then(() => setRemoteLiked(null));
              }}
              title={liked ? "取消喜欢" : "喜欢"}
              style={liked ? { color: "#ec4141" } : undefined}
            >
              <Heart size={18} fill={liked ? "currentColor" : "none"} />
            </button>
            <div
              className="vol-wrap"
              ref={volWrapRef}
              onPointerEnter={(event) => {
                captureInteractionOrigin(
                  "player-volume",
                  event.currentTarget.querySelector("button") ??
                    event.currentTarget,
                );
                setVolumeOpen(true);
              }}
              onFocus={(event) => {
                captureInteractionOrigin(
                  "player-volume",
                  event.currentTarget.querySelector("button") ??
                    event.currentTarget,
                );
                setVolumeOpen(true);
              }}
              onPointerLeave={() => setVolumeOpen(false)}
              onBlur={(event) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget as Node | null,
                  )
                )
                  setVolumeOpen(false);
              }}
            >
              <button className="icon-btn" onClick={toggleMute} title="静音">
                {muted || volume === 0 ? (
                  <VolumeX size={18} />
                ) : (
                  <Volume2 size={18} />
                )}
              </button>
              {volumeTransition.rendered && (
                <div
                  ref={volumeTransition.surfaceRef}
                  className={`volume-popover ${volumeTransition.surfaceClassName}`}
                  aria-label="音量调节"
                >
                  <span className="volume-value">
                    {Math.round((muted ? 0 : volume) * 100)}
                  </span>
                  <input
                    className="slider volume-slider"
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round((muted ? 0 : volume) * 100)}
                    style={{
                      ["--val" as never]: `${(muted ? 0 : volume) * 100}%`,
                    }}
                    onChange={(e) => setVolume(Number(e.target.value) / 100)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <style>{`
        .spin-dot {
          width: 16px; height: 16px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #fff;
          animation: spin var(--motion-spinner) linear infinite;
        }
      `}</style>
      </footer>

      {/* 弹窗必须渲染在 player-bar 之外：footer 的 transform/contain 会改变
        fixed 元素的包含块，导致弹窗相对播放条而非视口定位。 */}
      <ShareResourceDialog
        song={currentSong}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </>
  );
}
