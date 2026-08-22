import { useState } from "react";
import {
  Bookmark,
  Clapperboard,
  Heart,
  MessageCircle,
  X,
} from "lucide-react";
import type { CommentResource, SearchMediaInfo } from "../api/types.ts";
import { useCommentStore } from "../store/commentStore";
import { useMediaStore } from "../store/mediaStore.ts";
import { formatTime } from "../utils/lyrics";
import { sizedImage } from "../utils/image";
import { LoadingState } from "./Page";

function resourceFor(item: SearchMediaInfo): CommentResource {
  return {
    type: item.kind === "mv" ? "mv" : "video",
    id: item.id,
    title: item.name,
    subtitle: item.creatorName,
    coverUrl: item.coverUrl,
  };
}

export default function MediaDetailDialog() {
  const item = useMediaStore((state) => state.item);
  const detail = useMediaStore((state) => state.detail);
  const url = useMediaStore((state) => state.url);
  const stats = useMediaStore((state) => state.stats);
  const loading = useMediaStore((state) => state.loading);
  const actionLoading = useMediaStore((state) => state.actionLoading);
  const urlLoading = useMediaStore((state) => state.urlLoading);
  const resolution = useMediaStore((state) => state.resolution);
  const close = useMediaStore((state) => state.close);
  const setResolution = useMediaStore((state) => state.setResolution);
  const toggleLike = useMediaStore((state) => state.toggleLike);
  const toggleSubscription = useMediaStore((state) => state.toggleSubscription);
  const openComments = useCommentStore((state) => state.openResourceComments);
  const [coverFailed, setCoverFailed] = useState(false);
  if (!item) return null;
  const current = detail ?? item;
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
            <video src={url} controls autoPlay playsInline />
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
            <button className="modal-close" title="关闭" onClick={close}>
              <X size={18} />
            </button>
          </div>
          <div className="media-detail-actions">
            <div className="segmented-control" role="group" aria-label="清晰度">
              {[720, 1080].map((value) => (
                <button
                  key={value}
                  className={resolution === value ? "active" : ""}
                  onClick={() => void setResolution(value as 720 | 1080)}
                >
                  {value}p
                </button>
              ))}
            </div>
            <button
              className="btn"
              onClick={() => void openComments(resourceFor(item), true)}
            >
              <MessageCircle size={14} /> 评论
            </button>
            {stats && (
              <>
                <button
                  className={`btn ${stats.liked ? "active" : ""}`}
                  onClick={() => void toggleLike()}
                  disabled={actionLoading !== ""}
                  title={stats.liked ? "取消点赞" : "点赞"}
                >
                  <Heart
                    size={14}
                    fill={stats.liked ? "currentColor" : "none"}
                  />
                  {stats.liked ? "已赞" : "点赞"}
                </button>
                <button
                  className={`btn ${stats.subscribed ? "active" : ""}`}
                  onClick={() => void toggleSubscription()}
                  disabled={actionLoading !== ""}
                  title={stats.subscribed ? "取消收藏" : "收藏"}
                >
                  <Bookmark
                    size={14}
                    fill={stats.subscribed ? "currentColor" : "none"}
                  />
                  {stats.subscribed ? "已收藏" : "收藏"}
                </button>
              </>
            )}
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
