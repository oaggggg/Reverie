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
const CONTROLS_HIDE_DELAY = 2600;

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
  const hideTimer = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [showVolume, setShowVolume] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  useEffect(() => {
    // Resolution switches replace the src; keep the chosen speed applied.
    const el = videoRef.current;
    if (el) el.playbackRate = rate;
  }, [url, rate]);

  useEffect(() => {
    const onFsChange = () =>
      setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Close the quality menu when clicking anywhere outside of it.
  useEffect(() => {
    if (!qualityOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement | null)?.closest(".media-video-quality")) {
        setQualityOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [qualityOpen]);

  // Auto-hide the control bar while playing; any mouse movement brings it
  // back. Popups (volume / quality) keep it pinned.
  useEffect(() => {
    const scheduleHide = () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => {
        if (playing && !showVolume && !qualityOpen) setControlsVisible(false);
      }, CONTROLS_HIDE_DELAY);
    };
    setControlsVisible(true);
    scheduleHide();
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [playing, showVolume, qualityOpen]);

  if (!item) return null;
  const current = detail ?? item;

  const wakeControls = () => {
    setControlsVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    if (playing && !showVolume && !qualityOpen) {
      hideTimer.current = window.setTimeout(
        () => setControlsVisible(false),
        CONTROLS_HIDE_DELAY,
      );
    }
  };

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  const cycleRate = () => {
    setRate((r) => {
      const next =
        PLAYBACK_RATES[
          (PLAYBACK_RATES.indexOf(r) + 1) % PLAYBACK_RATES.length
        ];
      const el = videoRef.current;
      if (el) el.playbackRate = next;
      return next;
    });
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
          {urlLoading ? (
            <LoadingState label="正在获取播放地址…" />
          ) : url ? (
            <div
              className={`media-video-stage ${controlsVisible ? "" : "controls-hidden"} ${fullscreen ? "is-fullscreen" : ""}`}
              ref={stageRef}
              onMouseMove={wakeControls}
              onMouseLeave={() => {
                if (playing && !showVolume && !qualityOpen)
                  setControlsVisible(false);
              }}
            >
              {/* No native controls: WebView2's built-in bar carries an
                  overflow (three-dot) menu that cannot be disabled. */}
              <video
                ref={videoRef}
                src={url}
                autoPlay
                playsInline
                onClick={togglePlay}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onTimeUpdate={(e) =>
                  setCurrentTime(e.currentTarget.currentTime)
                }
                onDurationChange={(e) =>
                  setDuration(
                    Number.isFinite(e.currentTarget.duration)
                      ? e.currentTarget.duration
                      : 0,
                  )
                }
              />
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
                  onMouseLeave={() => setShowVolume(false)}
                >
                  {showVolume && (
                    <div className="media-video-volume-pop">
                      <div
                        className="media-video-volume-track"
                        onPointerDown={(e) => {
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
                <button
                  className="media-video-btn media-video-rate"
                  title="播放速度"
                  onClick={cycleRate}
                >
                  {rate}×
                </button>
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
