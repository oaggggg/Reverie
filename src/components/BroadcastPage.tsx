import { useEffect } from "react";
import { Activity, Heart, Radio, RefreshCw } from "lucide-react";
import { useBroadcastStore } from "../store/broadcastStore.ts";
import { sizedImage } from "../utils/image";
import { LoadingState, Page, PageHeader } from "./Page";
import BroadcastChannelDialog from "./BroadcastChannelDialog.tsx";
export default function BroadcastPage() {
  const channels = useBroadcastStore((s) => s.channels);
  const collected = useBroadcastStore((s) => s.collected);
  const sportSongs = useBroadcastStore((s) => s.sportSongs);
  const bpm = useBroadcastStore((s) => s.bpm);
  const loading = useBroadcastStore((s) => s.loading);
  const error = useBroadcastStore((s) => s.error);
  const load = useBroadcastStore((s) => s.load);
  const setBpm = useBroadcastStore((s) => s.setBpm);
  const toggle = useBroadcastStore((s) => s.toggle);
  const playSport = useBroadcastStore((s) => s.playSport);
  const activeChannel = useBroadcastStore((s) => s.activeChannel);
  const currentInfoLoading = useBroadcastStore((s) => s.currentInfoLoading);
  const openCurrentInfo = useBroadcastStore((s) => s.openCurrentInfo);
  const closeCurrentInfo = useBroadcastStore((s) => s.closeCurrentInfo);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <Page>
      <PageHeader
        title="广播电台"
        subtitle="广播频道、收藏与跑步漫游"
        actions={
          <button
            className="icon-button"
            title="刷新"
            onClick={() => void load()}
          >
            <RefreshCw size={17} />
          </button>
        }
      />
      <section className="broadcast-sport">
        <div>
          <h2>
            <Activity size={17} />
            跑步漫游
          </h2>
          <span>按节奏推荐适合运动的歌曲</span>
        </div>
        <input
          type="range"
          min="40"
          max="220"
          step="1"
          value={bpm}
          onChange={(event) => void setBpm(Number(event.target.value))}
        />
        <strong>{bpm} BPM</strong>
        <button
          className="primary-button"
          onClick={() => void playSport()}
          disabled={!sportSongs.length}
        >
          <Radio size={15} />
          播放推荐
        </button>
      </section>
      {collected.length > 0 && (
        <section className="broadcast-section">
          <div className="broadcast-head">
            <h2>我的收藏</h2>
            <span>{collected.length}</span>
          </div>
          <ChannelGrid
            channels={collected}
            onToggle={toggle}
            onOpen={openCurrentInfo}
          />
        </section>
      )}
      <section className="broadcast-section">
        <div className="broadcast-head">
          <h2>全部频道</h2>
          <span>{channels.length}</span>
        </div>
        {loading && !channels.length ? (
          <LoadingState label="正在加载广播频道…" />
        ) : channels.length ? (
          <ChannelGrid
            channels={channels}
            onToggle={toggle}
            onOpen={openCurrentInfo}
          />
        ) : (
          <div className="broadcast-empty">暂无广播频道</div>
        )}
      </section>
      {error && (
        <div className="broadcast-error" role="alert">
          {error}
        </div>
      )}
      <BroadcastChannelDialog
        open={Boolean(activeChannel)}
        channel={activeChannel}
        loading={currentInfoLoading}
        onClose={closeCurrentInfo}
      />
    </Page>
  );
}
function ChannelGrid({
  channels,
  onToggle,
  onOpen,
}: {
  channels: import("../api/types.ts").BroadcastChannel[];
  onToggle: (channel: import("../api/types.ts").BroadcastChannel) => void;
  onOpen: (channel: import("../api/types.ts").BroadcastChannel) => void;
}) {
  return (
    <div className="broadcast-grid">
      {channels.map((channel) => (
        <article className="broadcast-card" key={channel.id}>
          <button
            className="broadcast-card-open"
            title="查看当前节目"
            onClick={() => onOpen(channel)}
          >
            {channel.coverUrl ? (
              <img src={sizedImage(channel.coverUrl, 220)} alt="" />
            ) : (
              <span>
                <Radio size={25} />
              </span>
            )}
            <strong>{channel.name}</strong>
            <small>
              {channel.categoryName ||
                channel.regionName ||
                channel.description ||
                "广播频道"}
            </small>
          </button>
          <button
            className={`icon-button ${channel.subscribed ? "active" : ""}`}
            title={channel.subscribed ? "取消收藏" : "收藏"}
            onClick={() => onToggle(channel)}
          >
            <Heart
              size={15}
              fill={channel.subscribed ? "currentColor" : "none"}
            />
          </button>
        </article>
      ))}
    </div>
  );
}
