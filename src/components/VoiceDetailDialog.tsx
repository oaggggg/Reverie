import { useRef } from "react";
import { FileText, Mic2, X } from "lucide-react";
import type { VoiceItem } from "../api/types.ts";
import { sizedImage } from "../utils/image";
import { formatTime } from "../utils/lyrics";
import { LoadingState } from "./Page";
import { useOriginTransition } from "../utils/originTransition";

interface Props {
  open: boolean;
  voice: VoiceItem | null;
  lyric: string;
  loading: boolean;
  onClose: () => void;
}

export default function VoiceDetailDialog({
  open,
  voice,
  lyric,
  loading,
  onClose,
}: Props) {
  const cachedVoice = useRef<VoiceItem | null>(voice);
  if (voice) cachedVoice.current = voice;
  const transition = useOriginTransition<HTMLElement>(open, "voice-detail", 220);
  const currentVoice = cachedVoice.current;
  if (!transition.rendered || !currentVoice) return null;
  return (
    <div
      className={`modal-backdrop voice-detail-backdrop ${transition.backdropClassName}`}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section ref={transition.surfaceRef} className={`voice-detail-dialog ${transition.surfaceClassName}`} role="dialog" aria-modal="true">
        <header className="voice-detail-head">
          {currentVoice.coverUrl ? (
            <img src={sizedImage(currentVoice.coverUrl, 120)} alt="" />
          ) : (
            <span>
              <Mic2 size={22} />
            </span>
          )}
          <div>
            <h2>{currentVoice.name}</h2>
            <small>
              {currentVoice.voiceListName || "声音"} · {formatTime(currentVoice.duration)} ·{" "}
              {currentVoice.playCount.toLocaleString("zh-CN")} 次播放
            </small>
          </div>
          <button className="modal-close" title="关闭" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="voice-detail-content">
          <section>
            <h3>简介</h3>
            <p>{currentVoice.description || "暂无简介"}</p>
          </section>
          <section>
            <h3>
              <FileText size={14} /> 歌词
            </h3>
            {loading ? (
              <LoadingState label="正在加载声音详情…" />
            ) : (
              <pre>{lyric || "暂无歌词"}</pre>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
