import { useEffect, useState } from "react";
import {
  Compass,
  Download,
  Heart,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import type { PlaylistInfo } from "../api/types";
import { useExploreStore } from "../store/exploreStore";
import { usePlayerStore } from "../store/playerStore";
import { usePlaylistDiscoveryStore } from "../store/playlistDiscoveryStore";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { Page, PageHeader } from "./Page";
import PlaylistGrid from "./PlaylistGrid";
import PlaylistEditorModal from "./PlaylistEditorModal";
import ConfirmModal from "./ConfirmModal";
import PlaylistImportModal from "./PlaylistImportModal";
import {
  getUserCollectedPlaylists,
  getUserCreatedPlaylists,
} from "../api/extended";

export default function UserListPage() {
  const userPlaylists = usePlayerStore((s) => s.userPlaylists);
  const openPlaylist = usePlayerStore((s) => s.openPlaylist);
  const userPlaylistsLoading = usePlayerStore((s) => s.userPlaylistsLoading);
  const uid = usePlayerStore((s) => s.profile?.userId ?? 0);
  const loggedIn = usePlayerStore((s) => s.loggedIn);
  const deletePlaylist = useExploreStore((s) => s.deletePlaylist);
  const toggleSubscription = useExploreStore(
    (s) => s.togglePlaylistSubscription,
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PlaylistInfo | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PlaylistInfo | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [mode, setMode] = useState<"mine" | "discover">("mine");
  const [accountListMode, setAccountListMode] = useState<
    "all" | "created" | "collected"
  >("all");
  const [accountPlaylists, setAccountPlaylists] = useState<PlaylistInfo[]>([]);
  const [accountLoading, setAccountLoading] = useState(false);
  const discovery = usePlaylistDiscoveryStore();
  const discoveryMoreRef = useInfiniteScroll(
    () => void discovery.loadMore(),
    discovery.loadingMore || !discovery.more,
  );

  useEffect(() => {
    if (mode === "discover" && !discovery.loaded && !discovery.loading) {
      void discovery.load();
    }
  }, [discovery, mode]);

  useEffect(() => {
    if (mode !== "mine" || accountListMode === "all" || !uid) return;
    let alive = true;
    setAccountLoading(true);
    const task =
      accountListMode === "created"
        ? getUserCreatedPlaylists(uid)
        : getUserCollectedPlaylists(uid);
    void task
      .then((items) => {
        if (alive) setAccountPlaylists(items);
      })
      .catch(() => {
        if (alive) setAccountPlaylists([]);
      })
      .finally(() => {
        if (alive) setAccountLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [accountListMode, mode, uid]);

  const minePlaylists =
    accountListMode === "all" ? userPlaylists : accountPlaylists;

  return (
    <Page>
      <PageHeader
        title="我的歌单"
        subtitle={
          mode === "mine" ? "管理我创建和收藏的歌单" : "按分类发现高质量歌单"
        }
        actions={
          <div className="page-action-row">
            {mode === "mine" ? (
              <>
                <button className="btn" onClick={() => setImportOpen(true)}>
                  <Download size={15} /> 导入歌单
                </button>
                <button
                  className="btn primary"
                  onClick={() => {
                    setEditing(null);
                    setEditorOpen(true);
                  }}
                >
                  <Plus size={15} /> 创建歌单
                </button>
              </>
            ) : (
              <button
                className="btn"
                title="刷新歌单发现"
                onClick={() => void discovery.load(discovery.selectedTag)}
              >
                <RefreshCw size={15} /> 刷新
              </button>
            )}
          </div>
        }
      />
      <div className="playlist-view-tabs" role="tablist" aria-label="歌单视图">
        <button
          className={mode === "mine" ? "active" : ""}
          role="tab"
          aria-selected={mode === "mine"}
          onClick={() => setMode("mine")}
        >
          <Heart size={15} /> 我的歌单
        </button>
        <button
          className={mode === "discover" ? "active" : ""}
          role="tab"
          aria-selected={mode === "discover"}
          onClick={() => setMode("discover")}
        >
          <Compass size={15} /> 发现歌单
        </button>
      </div>
      {mode === "mine" ? (
        <>
          <div
            className="playlist-view-tabs"
            role="tablist"
            aria-label="账户歌单范围"
          >
            <button
              className={accountListMode === "all" ? "active" : ""}
              onClick={() => setAccountListMode("all")}
            >
              全部
            </button>
            <button
              className={accountListMode === "created" ? "active" : ""}
              onClick={() => setAccountListMode("created")}
            >
              我创建
            </button>
            <button
              className={accountListMode === "collected" ? "active" : ""}
              onClick={() => setAccountListMode("collected")}
            >
              我收藏
            </button>
          </div>
          <PlaylistGrid
            playlists={minePlaylists}
            onOpen={openPlaylist}
            loading={accountLoading || userPlaylistsLoading}
            emptyText={
              !loggedIn
                ? "登录后查看「我创建 / 收藏的歌单」"
                : accountListMode === "created"
                  ? "还没有创建歌单，点右上角「创建歌单」试试"
                  : accountListMode === "collected"
                    ? "还没有收藏歌单，去发现页逛逛吧"
                    : "暂无歌单"
            }
            renderActions={(playlist) =>
              playlist.id === userPlaylists[0]?.id ? null :
              playlist.creatorId === uid ? (
                <>
                  <button
                    className="icon-action"
                    title="编辑歌单"
                    onClick={() => {
                      setEditing(playlist);
                      setEditorOpen(true);
                    }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-action danger"
                    title="删除歌单"
                    onClick={() => setPendingDelete(playlist)}
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              ) : (
                <button
                  className={`icon-action ${playlist.subscribed ? "active" : ""}`}
                  title={playlist.subscribed ? "取消收藏" : "收藏歌单"}
                  onClick={() => void toggleSubscription(playlist)}
                >
                  <Heart
                    size={15}
                    fill={playlist.subscribed ? "currentColor" : "none"}
                  />
                </button>
              )
            }
          />
        </>
      ) : (
        <>
          <div className="playlist-discovery-toolbar">
            <div
              className="playlist-discovery-tags"
              role="tablist"
              aria-label="热门歌单标签"
            >
              {[
                { id: 0, name: "全部" },
                ...discovery.highQualityTags,
                ...discovery.hotTags,
              ]
                .filter(
                  (tag, index, items) =>
                    items.findIndex((item) => item.name === tag.name) === index,
                )
                .map((tag) => (
                  <button
                    key={`${tag.id}-${tag.name}`}
                    className={
                      discovery.selectedTag === tag.name ? "active" : ""
                    }
                    onClick={() => void discovery.load(tag.name)}
                  >
                    {tag.name}
                  </button>
                ))}
            </div>
            <label className="playlist-discovery-select">
              <span>分类</span>
              <select
                value={discovery.selectedTag}
                onChange={(event) => void discovery.load(event.target.value)}
              >
                <option value="全部">全部分类</option>
                {discovery.categories
                  .filter((category) => category.name !== "全部")
                  .map((category) => (
                    <option
                      key={`${category.id}-${category.name}`}
                      value={category.name}
                    >
                      {category.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <PlaylistGrid
            playlists={discovery.playlists}
            onOpen={openPlaylist}
            loading={discovery.loading}
            emptyText="暂无精品歌单"
            renderActions={(playlist) => (
              <button
                className={`icon-action ${playlist.subscribed ? "active" : ""}`}
                title={playlist.subscribed ? "取消收藏" : "收藏歌单"}
                onClick={() => void toggleSubscription(playlist)}
              >
                <Heart
                  size={15}
                  fill={playlist.subscribed ? "currentColor" : "none"}
                />
              </button>
            )}
          />
          {discovery.more && (
            <div ref={discoveryMoreRef} className="load-more-sentinel" />
          )}
        </>
      )}
      <PlaylistEditorModal
        playlist={editing}
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
      />
      <ConfirmModal
        open={pendingDelete !== null}
        title="删除歌单"
        message={`确定删除「${pendingDelete?.name ?? "这个歌单"}」吗？删除后无法恢复。`}
        onClose={() => setPendingDelete(null)}
        onConfirm={() =>
          pendingDelete ? deletePlaylist(pendingDelete) : false
        }
      />
      <PlaylistImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onCompleted={() => {
          setImportOpen(false);
          void usePlayerStore.getState().loadUserPlaylists();
        }}
      />
    </Page>
  );
}
