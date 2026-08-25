import { useEffect } from "react";
import { Clapperboard, Film, RefreshCw } from "lucide-react";
import { useVideoStore } from "../store/videoStore.ts";
import { useMediaStore } from "../store/mediaStore.ts";
import { Page, PageHeader } from "./Page";
import { sizedImage } from "../utils/image";

export default function VideoPage() {
  const mode = useVideoStore((s) => s.mode);
  const groups = useVideoStore((s) => s.groups);
  const selectedGroup = useVideoStore((s) => s.selectedGroup);
  const videos = useVideoStore((s) => s.videos);
  const loading = useVideoStore((s) => s.loading);
  const load = useVideoStore((s) => s.load);
  const setMode = useVideoStore((s) => s.setMode);
  const selectGroup = useVideoStore((s) => s.selectGroup);
  const mvArea = useVideoStore((s) => s.mvArea);
  const mvType = useVideoStore((s) => s.mvType);
  const mvOrder = useVideoStore((s) => s.mvOrder);
  const setMvFilters = useVideoStore((s) => s.setMvFilters);
  const openMedia = useMediaStore((s) => s.open);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <Page>
      <PageHeader
        title="视频中心"
        subtitle="推荐、全部与分类视频"
        actions={
          <button
            className="icon-button"
            title="刷新视频"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={17} className={loading ? "spin" : ""} />
          </button>
        }
      />
      <div className="collection-tabs" role="tablist" aria-label="视频分类">
        <button
          className={mode === "recommend" ? "active" : ""}
          onClick={() => void setMode("recommend")}
        >
          推荐
        </button>
        <button
          className={mode === "all" ? "active" : ""}
          onClick={() => void setMode("all")}
        >
          全部
        </button>
        <button
          className={mode === "mv-top" ? "active" : ""}
          onClick={() => void setMode("mv-top")}
        >
          <Film size={14} /> MV榜单
        </button>
        <button
          className={mode === "mv-first" ? "active" : ""}
          onClick={() => void setMode("mv-first")}
        >
          <Film size={14} /> 最新MV
        </button>
        <button
          className={mode === "mv-exclusive" ? "active" : ""}
          onClick={() => void setMode("mv-exclusive")}
        >
          <Film size={14} /> 网易出品
        </button>
        <button
          className={mode === "mv-all" ? "active" : ""}
          onClick={() => void setMode("mv-all")}
        >
          <Film size={14} /> 全部MV
        </button>
        <button
          className={mode === "playlist-recent" ? "active" : ""}
          onClick={() => void setMode("playlist-recent")}
        >
          歌单视频
        </button>
        <button
          className={mode === "my-like" ? "active" : ""}
          onClick={() => void setMode("my-like")}
        >
          我赞过
        </button>
        {groups.map((group) => (
          <button
            key={group.id}
            className={
              mode === "group" && selectedGroup === group.id ? "active" : ""
            }
            onClick={() => void selectGroup(group.id)}
          >
            {group.name}
          </button>
        ))}
      </div>
      {mode.startsWith("mv-") && (
        <div className="video-mv-filters">
          <label>
            地区
            <select
              value={mvArea}
              onChange={(event) =>
                void setMvFilters({
                  mvArea: event.target.value as typeof mvArea,
                })
              }
              disabled={loading}
            >
              {(["全部", "内地", "港台", "欧美", "日本", "韩国"] as const).map(
                (area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ),
              )}
            </select>
          </label>
          {mode === "mv-all" && (
            <>
              <label>
                类型
                <select
                  value={mvType}
                  onChange={(event) =>
                    void setMvFilters({
                      mvType: event.target.value as typeof mvType,
                    })
                  }
                  disabled={loading}
                >
                  {(
                    ["全部", "官方版", "原生", "现场版", "网易出品"] as const
                  ).map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                排序
                <select
                  value={mvOrder}
                  onChange={(event) =>
                    void setMvFilters({
                      mvOrder: event.target.value as typeof mvOrder,
                    })
                  }
                  disabled={loading}
                >
                  {(["上升最快", "最热", "最新"] as const).map((order) => (
                    <option key={order} value={order}>
                      {order}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
      )}
      {loading && !videos.length ? (
        <div className="loading-hint">正在加载视频…</div>
      ) : videos.length ? (
        <div className="media-grid video-grid">
          {videos.map((video) => (
            <button
              className="media-card video-card"
              key={video.id}
              onClick={() => void openMedia(video)}
            >
              <span className="card-cover">
                {video.coverUrl ? (
                  <img
                    src={sizedImage(video.coverUrl, 360)}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <Clapperboard size={28} />
                )}
              </span>
              <strong>{video.name}</strong>
              <span>{video.creatorName || "网易云视频"}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty">暂无视频内容</div>
      )}
    </Page>
  );
}
