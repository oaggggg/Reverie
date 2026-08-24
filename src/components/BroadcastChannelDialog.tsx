import { useRef } from "react";
import { Info, Play, Radio, X } from "lucide-react";
import type { BroadcastChannel } from "../api/types.ts";
import { usePlayerStore } from "../store/playerStore.ts";
import { sizedImage } from "../utils/image";
import { LoadingState } from "./Page";
import { useOriginTransition } from "../utils/originTransition";

interface Props {
  open: boolean;
  channel: BroadcastChannel | null;
  loading: boolean;
  onClose: () => void;
}

export default function BroadcastChannelDialog({
  open,
  channel,
  loading,
  onClose,
}: Props) {
  const playSong = usePlayerStore((state) => state.playSong);
  const cachedChannel = useRef<BroadcastChannel | null>(channel);
  if (channel) cachedChannel.current = channel;
  const transition = useOriginTransition<HTMLElement>(
    open,
    "broadcast-detail",
    220,
  );
  const currentChannel = cachedChannel.current;
  if (!transition.rendered || !currentChannel) return null;
  return (
    <div
      className={`modal-backdrop broadcast-detail-backdrop ${transition.backdropClassName}`}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={transition.surfaceRef}
        className={`broadcast-detail-dialog ${transition.surfaceClassName}`}
        role="dialog"
        aria-modal="true"
      >
        <header className="broadcast-detail-head">
          {currentChannel.coverUrl ? (
            <img src={sizedImage(currentChannel.coverUrl, 160)} alt="" />
          ) : (
            <span>
              <Radio size={24} />
            </span>
          )}
          <div>
            <span className="broadcast-detail-kicker">
              <Info size={13} /> 广播频道
            </span>
            <h2>{currentChannel.name}</h2>
            <small>
              {currentChannel.categoryName || currentChannel.regionName || "广播频道"}
            </small>
          </div>
          <button className="modal-close" title="关闭" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        {loading ? (
          <LoadingState label="正在加载频道信息…" />
        ) : (
          <div className="broadcast-detail-content">
            <p>{currentChannel.description || "暂无频道简介"}</p>
            {currentChannel.currentSong ? (
              <div className="broadcast-current-song">
                <div>
                  <strong>{currentChannel.currentSong.name}</strong>
                  <span>{currentChannel.currentSong.artists}</span>
                </div>
                <button
                  className="primary-button"
                  onClick={() =>
                    void playSong(currentChannel.currentSong!, [currentChannel.currentSong!])
                  }
                >
                  <Play size={14} fill="currentColor" /> 播放
                </button>
              </div>
            ) : (
              <div className="broadcast-detail-empty">暂无当前节目</div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
