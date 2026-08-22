import { useEffect, useRef, useState } from "react";
import {
  Clapperboard,
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useMediaStore } from "../store/mediaStore.ts";
import { formatTime } from "../utils/lyrics";
import { sizedImage } from "../utils/image";
import { LoadingState } from "./Page";

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const CONTROLS_HIDE_DELAY = 3000;
const CONTROLS_LEAVE_HIDE_DELAY = 800;

function fmt(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function MediaDetailDialog() {
  const item = useMediaStore((state) => state.item);
  const detail = useMediaStore((state) => state.detail);
  const url = useMediaStore((state) => state.url);
  const stats = useMediaStore((state) => state.stats);
  const loading = useMediaStore((state) => state.loading);
  const urlLoading = useMediaStore((state) => state.urlLoading);
  const resolution = useMediaStore((state) => state.resolution);
  const close = useMediaStore((state) => state.close);
  const setResolution = useMediaStore((state) => state.setResolution);
  const [coverFailed, setCoverFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [showVolume, setShowVolume] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fsExiting, setFsExiting] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  // Live flags for the hide timer; state values would be stale in the
  // window.setTimeout closure after rapid interactions.
  const playingRef = useRef(false);
  const showVolumeRef = useRef(false);
  const qualityOpenRef = useRef(false);
  const rateOpenRef = useRef(false);
  const volumeDraggingRef = useRef(false);
  /** URL currently shown; pendingUrl preloads the next quality in a hidden
   * sibling video and is promoted once its first frame is decoded. */
  const [activeUrl, setActiveUrl] = useState("");
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const activeUrlRef = useRef("");
  useEffect(() => {
    activeUrlRef.current = activeUrl;
  }, [activeUrl]);

  // Promote the preloading video to active exactly once per switch.
  const pendingPromotedRef = useRef(true);
  const promotePending = (el: HTMLVideoElement, src: string) => {
    if (pendingPromotedRef.current) return;
    pendingPromotedRef.current = true;
    setActiveUrl(src);
    setPendingUrl(null);
    void el.play().catch(() => {});
  };

  useEffect(() => {
    if (!url) return;
    if (!activeUrlRef.current) {
      // First URL for this item: becomes the visible video right away.
      setActiveUrl(url);
      return;
    }
    // Same URL again (e.g. reopen) → nothing to do; different → preload.
    if (url !== activeUrlRef.current && url !== pendingUrl) {
      pendingPromotedRef.current = false;
      setPendingUrl(url);
    }
  }, [url, pendingUrl]);

  // A different item must not replay the previous item's video while its own
  // URL is still loading.
  const prevItemIdRef = useRef(item?.id);
  if (prevItemIdRef.current !== item?.id) {
    prevItemIdRef.current = item?.id;
    activeUrlRef.current = "";
    if (activeUrl) {
      setActiveUrl("");
      setPendingUrl(null);
    }
  }

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    showVolumeRef.current = showVolume;
  }, [showVolume]);
  useEffect(() => {
    qualityOpenRef.current = qualityOpen;
  }, [qualityOpen]);
  useEffect(() => {
    rateOpenRef.current = rateOpen;
  }, [rateOpen]);

  useEffect(() => {
    // A promoted video is a fresh element; keep the chosen speed applied.
    const el = videoRef.current;
    if (el) el.playbackRate = rate;
  }, [activeUrl, rate]);

  useEffect(() => {
    // Exiting fullscreen animates the top-layer element flying from the
    // fullscreen rect back to its normal spot (very visible when the app
    // window is not maximized). Briefly hide the stage so only a clean
    // cut remains.
    const onFsChange = () => {
      const active = Boolean(document.fullscreenElement);
      setFullscreen(active);
      if (!active) {
        setFsExiting(true);
        window.setTimeout(() => setFsExiting(false), 300);
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Close the popups (quality / rate) when clicking anywhere outside of them.
  useEffect(() => {
    if (!qualityOpen && !rateOpen) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest(".media-video-quality")) setQualityOpen(false);
      if (!target?.closest(".media-video-rate")) setRateOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [qualityOpen, rateOpen]);

  // Control bar follows mainstream player (YouTube/Bilibili) behavior:
  // - move inside the player → show, idle ~3s while playing → hide (+cursor)
  // - paused with the mouse inside → keep visible
  // - mouse leaves the player → hide shortly (popups/dragging still pin it)
  // - fullscreen uses the same rules (the stage is the whole screen)
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let timer: number | null = null;
    const popupsPinned = () =>
      showVolumeRef.current ||
      qualityOpenRef.current ||
      rateOpenRef.current ||
      volumeDraggingRef.current;
    const hide = (requirePlaying: boolean, delay: number) => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (popupsPinned()) return;
        if (requirePlaying && !playingRef.current) return;
        setControlsVisible(false);
      }, delay);
    };
    const onMove = () => {
      setControlsVisible(true);
      hide(true, CONTROLS_HIDE_DELAY);
    };
    const onLeave = () => hide(false, CONTROLS_LEAVE_HIDE_DELAY);
    stage.addEventListener("mousemove", onMove);
    stage.addEventListener("mouseleave", onLeave);
    return () => {
      stage.removeEventListener("mousemove", onMove);
      stage.removeEventListener("mouseleave", onLeave);
      if (timer) window.clearTimeout(timer);
    };
  }, [url]);

  // Start/pause must also wake the bar (e.g. clicking the video to pause).
  useEffect(() => {
    setControlsVisible(true);
  }, [playing]);

  if (!item) return null;
  const current = detail ?? item;

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  const setRateTo = (value: number) => {
    setRate(value);
    const el = videoRef.current;
    if (el) el.playbackRate = value;
  };

  const seekTo = (value: number) => {
    const el = videoRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = value;
    setCurrentTime(value);
  };

  const applyVolume = (value: number) => {
    const v = Math.min(1, Math.max(0, value));
    setVolume(v);
    const el = videoRef.current;
    if (el) {
      el.volume = v;
      el.muted = v === 0;
    }
  };

  const toggleMute = () => applyVolume(volume === 0 ? 1 : 0);

  const toggleFullscreen = () => {
    const stage = stageRef.current;
    if (!stage) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stage.requestFullscreen();
  };

  const VolumeIcon =
    volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      className="modal-backdrop media-detail-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div
        className="media-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-detail-title"
      >
        <div className="media-detail-video">
          {urlLoading && !activeUrl ? (
            <LoadingState label="正在获取播放地址…" />
          ) : activeUrl ? (
            <div
              className={`media-video-stage ${controlsVisible ? "" : "controls-hidden"} ${fullscreen ? "is-fullscreen" : ""} ${fsExiting ? "fs-exiting" : ""}`}
              ref={stageRef}
            >
              {/* No native controls: WebView2's built-in bar carries an
                  overflow (three-dot) menu that cannot be disabled. Quality
                  switches preload the new URL in a hidden sibling video and
                  promote it once its first frame is ready — swapping src on a
                  single element drops the picture and flashes. */}
              {[activeUrl, pendingUrl]
                .filter((src): src is string => Boolean(src))
                .map((src, i) => (
                <video
                  key={src}
                  ref={i === 0 ? videoRef : undefined}
                  className={i === 0 ? undefined : "media-video-preload"}
                  src={src}
                  autoPlay={i === 0}
                  preload={i === 0 ? undefined : "auto"}
                  playsInline
                  onClick={i === 0 ? togglePlay : undefined}
                  onPlay={i === 0 ? () => setPlaying(true) : undefined}
                  onPause={i === 0 ? () => setPlaying(false) : undefined}
                  onTimeUpdate={
                    i === 0
                      ? (e) => setCurrentTime(e.currentTarget.currentTime)
                      : undefined
                  }
                  onDurationChange={
                    i === 0
                      ? (e) =>
                          setDuration(
                            Number.isFinite(e.currentTarget.duration)
                              ? e.currentTarget.duration
                              : 0,
                          )
                      : undefined
                  }
                  onCanPlay={
                    i === 1
                      ? (e) => {
                          // First frame decoded. Seek the hidden video to the
                          // current position first; promote on seeked so the
                          // reveal never shows an unbuffers/blank frame.
                          const el = e.currentTarget;
                          if (pendingPromotedRef.current) return;
                          el.playbackRate = rate;
                          el.volume = volume;
                          el.muted = volume === 0;
                          const t = videoRef.current?.currentTime ?? 0;
                          if (Math.abs(el.currentTime - t) < 0.05) {
                            promotePending(el, src);
                            return;
                          }
                          el.currentTime = t;
                          // Safety net in case `seeked` never fires.
                          window.setTimeout(
                            () => promotePending(el, src),
                            1500,
                          );
                        }
                      : undefined
                  }
                  onSeeked={
                    i === 1
                      ? (e) => promotePending(e.currentTarget, src)
                      : undefined
                  }
                />
              ))}
              {pendingUrl && (
                <span className="media-video-switch-hint">
                  切换至 {resolution}P…
                </span>
              )}
              {!playing && (
                <button
                  className="media-video-center-play"
                  title="播放"
                  onClick={togglePlay}
                >
                  <Play size={30} fill="currentColor" />
                </button>
              )}
              <div
                className="media-video-controls"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="media-video-btn"
                  title={playing ? "暂停" : "播放"}
                  onClick={togglePlay}
                >
                  {playing ? (
                    <Pause size={16} />
                  ) : (
                    <Play size={16} fill="currentColor" />
                  )}
                </button>
                <span className="media-video-time">
                  {fmt(currentTime)} / {fmt(duration)}
                </span>
                <input
                  className="media-video-seek"
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={Math.min(currentTime, duration || 0)}
                  onChange={(e) => seekTo(Number(e.target.value))}
                  aria-label="播放进度"
                />
                <div
                  className="media-video-volume"
                  onMouseEnter={() => setShowVolume(true)}
                  onMouseLeave={() => {
                    // Keep the popup while dragging: pointer capture sends the
                    // events to the slider, but the pointer can leave the
                    // wrapper's box mid-drag.
                    if (!volumeDraggingRef.current) setShowVolume(false);
                  }}
                >
                  {showVolume && (
                    <div className="media-video-volume-pop">
                      <div
                        className="media-video-volume-track"
                        onPointerDown={(e) => {
                          volumeDraggingRef.current = true;
                          e.currentTarget.setPointerCapture(e.pointerId);
                          const rect = e.currentTarget.getBoundingClientRect();
                          applyVolume(1 - (e.clientY - rect.top) / rect.height);
                        }}
                        onPointerMove={(e) => {
                          if (e.buttons !== 1) return;
                          const rect =
                            e.currentTarget.getBoundingClientRect();
                          applyVolume(1 - (e.clientY - rect.top) / rect.height);
                        }}
                        onPointerUp={() => {
                          volumeDraggingRef.current = false;
                        }}
                        onPointerCancel={() => {
                          volumeDraggingRef.current = false;
                        }}
                        role="slider"
                        aria-label="音量"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(volume * 100)}
                      >
                        <div
                          className="media-video-volume-fill"
                          style={{ height: `${volume * 100}%` }}
                        />
                        <div
                          className="media-video-volume-thumb"
                          style={{ bottom: `${volume * 100}%` }}
                        />
                      </div>
                      <span className="media-video-volume-num">
                        {Math.round(volume * 100)}
                      </span>
                    </div>
                  )}
                  <button
                    className="media-video-btn"
                    title={volume === 0 ? "取消静音" : "静音"}
                    onClick={toggleMute}
                  >
                    <VolumeIcon size={16} />
                  </button>
                </div>
                <div className="media-video-rate">
                  {rateOpen && (
                    <div className="media-video-rate-menu">
                      {PLAYBACK_RATES.slice()
                        .reverse()
                        .map((value) => (
                          <button
                            key={value}
                            className={rate === value ? "active" : ""}
                            onClick={() => {
                              setRateOpen(false);
                              setRateTo(value);
                            }}
                          >
                            {value}×{rate === value ? " ✓" : ""}
                          </button>
                        ))}
                    </div>
                  )}
                  <button
                    className="media-video-btn media-video-rate-btn"
                    title="播放速度"
                    onClick={() => setRateOpen((open) => !open)}
                  >
                    {rate}×
                  </button>
                </div>
                <div className="media-video-quality">
                  {qualityOpen && (
                    <div className="media-video-quality-menu">
                      {[1080, 720].map((value) => (
                        <button
                          key={value}
                          className={resolution === value ? "active" : ""}
                          onClick={() => {
                            setQualityOpen(false);
                            if (resolution !== value)
                              void setResolution(value as 720 | 1080);
                          }}
                        >
                          {value}P{resolution === value ? " ✓" : ""}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    className="media-video-btn media-video-quality-btn"
                    title="画质"
                    onClick={() => setQualityOpen((open) => !open)}
                  >
                    {resolution}P
                  </button>
                </div>
                <button
                  className="media-video-btn"
                  title={fullscreen ? "退出全屏" : "全屏"}
                  onClick={toggleFullscreen}
                >
                  {fullscreen ? (
                    <Minimize size={16} />
                  ) : (
                    <Maximize size={16} />
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="media-detail-video-empty">
              <Clapperboard size={28} />
              <span>暂时无法播放</span>
            </div>
          )}
        </div>
        <div className="media-detail-body">
          <div className="media-detail-head">
            {current.coverUrl && !coverFailed ? (
              <img
                src={sizedImage(current.coverUrl, 160)}
                alt=""
                onError={() => setCoverFailed(true)}
              />
            ) : (
              <span className="media-detail-cover-placeholder">
                <Clapperboard size={24} />
              </span>
            )}
            <div className="media-detail-title">
              <h2 id="media-detail-title">{current.name}</h2>
              <span>
                {current.creatorName || "未知创作者"} ·{" "}
                {formatTime(current.duration)}
              </span>
              <small>
                {current.playCount
                  ? `${current.playCount.toLocaleString()} 次播放`
                  : "播放量未知"}
              </small>
            </div>
          </div>
          {loading ? (
            <LoadingState label="正在加载详情…" />
          ) : detail?.description ? (
            <p className="media-detail-description">{detail.description}</p>
          ) : null}
          {stats && (
            <div className="media-detail-stats">
              <span>点赞 {stats.likedCount.toLocaleString("zh-CN")}</span>
              <span>分享 {stats.shareCount.toLocaleString("zh-CN")}</span>
              <span>评论 {stats.commentCount.toLocaleString("zh-CN")}</span>
              <span>收藏 {stats.subCount.toLocaleString("zh-CN")}</span>
            </div>
          )}
          {!!detail?.tags.length && (
            <div className="media-detail-tags">
              {detail.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
