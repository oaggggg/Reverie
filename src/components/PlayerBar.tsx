import { useEffect, useRef, useState } from "react";
import { getDynamicSongCover, getSongLikeStatus, getSongCollectionCounts } from "../api/songStatus";
import { getResourceComments } from "../api/comment";
import {
  ALL_PLAYBACK_QUALITIES,
  PLAYBACK_QUALITY_LABELS,
  PLAYBACK_QUALITY_TIER,
  isVipSong,
  qualityAllowedFor,
  userQualityTier,
  usePlayerStore,
} from "../store/playerStore";
import { formatTime } from "../utils/lyrics";
import { sizedImage } from "../utils/image";
import { formatCount } from "../utils/formatCount";
import { captureCoverOrigin } from "../utils/sharedCoverTransition";
import {
  captureInteractionOrigin,
  useOriginTransition,
} from "../utils/originTransition";
import {
  preloadNowPlayingAssets,
  warmCoverImage,
} from "../utils/nowPlayingPreload";
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
  // 封面渐显渐隐：front 层是新封面（加载完成后淡入），back 层是旧封面
  // （在新层完全显示前保持可见），配合 rotor 容器统一旋转实现丝滑过渡。
  const [coverLayers, setCoverLayers] = useState<
    Array<{ url: string; ready: boolean }>
  >([]);
  const [failedCovers, setFailedCovers] = useState<string[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [dynamicCover, setDynamicCover] = useState("");
  const [remoteLiked, setRemoteLiked] = useState<boolean | null>(null);
  const [remoteCommentCount, setRemoteCommentCount] = useState<number | null>(null);
  const [remoteCollectionCount, setRemoteCollectionCount] = useState<number | null>(null);
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
  // 未登录时不展示任何歌曲：本地会话恢复的 currentSong 只属于已登录会话。
  const currentSong = usePlayerStore((s) =>
    s.loggedIn ? s.currentSong : null,
  );
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
    setRemoteCommentCount(null);
    setRemoteCollectionCount(null);
    if (!currentSong) return;
    // 预热播放栏 120px 缩略图与队列下一曲：封面在真正挂载前已进缓存。
    warmCoverImage(currentSong.picUrl, 120);
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
    void getResourceComments({ type: "song", id: String(currentSong.id), title: currentSong.name }, 1, "hot", "", 1)
      .then((result) => {
        if (alive && Number.isFinite(result.total)) setRemoteCommentCount(Math.max(0, result.total));
      })
      .catch(() => {});
    void getSongCollectionCounts([currentSong.id])
      .then((counts) => {
        if (alive && currentSong.id in counts) setRemoteCollectionCount(counts[currentSong.id]!);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [currentSong?.id, loggedIn]);

  const coverUrl = dynamicCover || currentSong?.picUrl || "";
  const visibleCover =
    coverUrl && !failedCovers.includes(coverUrl) ? coverUrl : "";

  // 封面层编排：新封面作为 front 层入栈（未加载完成前透明），
  // 旧封面保留为 back 层垫底，淡入完成后由 prune effect 移除。
  useEffect(() => {
    if (!visibleCover) {
      setCoverLayers([]);
      return;
    }
    setCoverLayers((prev) => {
      if (prev[0]?.url === visibleCover) return prev;
      const reused = prev.find((layer) => layer.url === visibleCover);
      const rest = prev
        .filter((layer) => layer.url !== visibleCover)
        .slice(0, 1);
      return [{ url: visibleCover, ready: reused?.ready ?? false }, ...rest];
    });
  }, [visibleCover]);

  useEffect(() => {
    if (coverLayers.length < 2 || !coverLayers[0]?.ready) return;
    const timer = window.setTimeout(
      () => setCoverLayers((current) => current.slice(0, 1)),
      620,
    );
    return () => window.clearTimeout(timer);
  }, [coverLayers]);

  const handleCoverLoad = (url: string) => {
    setCoverLayers((current) => {
      // 幂等：层已就绪时必须返回原引用。内联 ref 每次渲染都会重跑，
      // 图片 complete 后 attachCoverRef 会在 commit 阶段同步走到这里，
      // 若每次都产出新数组就会形成 setState→重渲染→ref→setState 的
      // 嵌套更新死循环（Maximum update depth），React 卸载整棵树，
      // 表现为启动白屏。
      const target = current.find((layer) => layer.url === url);
      if (!target || target.ready) return current;
      return current.map((layer) =>
        layer.url === url ? { ...layer, ready: true } : layer,
      );
    });
  };
  const handleCoverError = (url: string) => {
    setFailedCovers((current) =>
      current.includes(url) ? current : [...current, url],
    );
    setCoverLayers((current) => current.filter((layer) => layer.url !== url));
  };
  // 预热命中的图片可能在 load 事件派发前就已 complete：
  // 挂载时兜底检查，避免前层永远停留在透明状态导致旧图滞留。
  // 淡入本身由 .on 的关键帧动画驱动（首帧即带终态也会播放），
  // 因此无需再推迟标记时序。
  const attachCoverRef = (url: string, el: HTMLImageElement | null) => {
    if (!el || !el.complete || el.naturalWidth <= 0) return;
    handleCoverLoad(url);
  };

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
              {/* 渐显渐隐封面：rotor 统一旋转；渲染顺序反转让旧封面
                  （back）先入 DOM 垫底、新封面（front）最后入 DOM 叠在
                  上层，加载完成后淡入盖过旧图；.on 只由就绪状态驱动，
                  旧层在被清理前始终保持可见，切换过程不再出现空窗。 */}
              <div className="pb-cover-rotor">
                {!coverLayers.some((layer) => layer.ready) && (
                  <div className="pb-cover-ph">
                    <Turntable size={21} />
                  </div>
                )}
                {[...coverLayers].reverse().map((layer) => (
                  <img
                    key={layer.url}
                    ref={(el) => attachCoverRef(layer.url, el)}
                    className={`pb-cover-layer${layer.ready ? " on" : ""}`}
                    src={sizedImage(layer.url, 120)}
                    alt=""
                    decoding="async"
                    onLoad={() => handleCoverLoad(layer.url)}
                    onError={() => handleCoverError(layer.url)}
                  />
                ))}
              </div>
            </div>
            <div className="pb-info">
              <div className="t">
                <span className="pb-title">
                  {currentSong?.name ?? "未在播放"}
                </span>
                {isVipSong(currentSong) && (
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
                  // 打开菜单即静默校验一次会员信息，保证身份门槛判定新鲜
                  void usePlayerStore.getState().loadVipInfo();
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
                  {/* 只列出当前歌曲支持的音质（官方 plLevel/位图推导），
                      身份不够的仍显示但锁定并标注所需会员 */}
                  {ALL_PLAYBACK_QUALITIES.filter((q) =>
                    availablePlaybackQualities.includes(q),
                  ).map((quality) => {
                    const tier = userQualityTier(usePlayerStore.getState());
                    const allowed = qualityAllowedFor(quality, tier);
                    const need = PLAYBACK_QUALITY_TIER[quality];
                    return (
                      <button
                        key={quality}
                        className={[
                          quality === playbackQuality ? "active" : "",
                          !allowed ? "locked" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        role="menuitemradio"
                        aria-checked={quality === playbackQuality}
                        disabled={!allowed}
                        title={
                          !allowed
                            ? need === "svip"
                              ? "需要黑胶超级会员（SVIP）"
                              : "需要网易云音乐会员（VIP）"
                            : undefined
                        }
                        onClick={() => {
                          setQualityOpen(false);
                          void setPlaybackQuality(quality);
                        }}
                      >
                        <span>{PLAYBACK_QUALITY_LABELS[quality]}</span>
                        {/* 免费/免费可听不加标识；VIP/SVIP 音质按官方权益加标 */}
                        {need !== "free" && (
                          <span
                            className={`pb-quality-tier ${need}`}
                            aria-label={need === "svip" ? "超级会员" : "会员"}
                          >
                            {need === "svip" ? "SVIP" : "VIP"}
                          </span>
                        )}
                        {quality === playbackQuality && (
                          <span aria-hidden="true">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button
              className={`icon-btn player-stat-btn ${showPlayerComments ? "active" : ""}`}
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
              <span className="player-stat-count">{formatCount(remoteCommentCount ?? currentSong?.commentCount)}</span>
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
              className={`icon-btn player-stat-btn ${liked ? "active" : ""}`}
              onClick={() => {
                setRemoteLiked(!liked);
                void toggleLike().then(() => setRemoteLiked(null));
              }}
              title={liked ? "取消喜欢" : "喜欢"}
              style={liked ? { color: "#ec4141" } : undefined}
            >
              <Heart size={18} fill={liked ? "currentColor" : "none"} />
              <span className="player-stat-count">{formatCount(remoteCollectionCount ?? currentSong?.likedCount)}</span>
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
