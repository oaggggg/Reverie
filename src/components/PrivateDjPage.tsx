import { useEffect, useMemo, useState } from "react";
import { Headphones, Mic2, RefreshCw } from "lucide-react";
import {
  getPersonalFmByMode,
  getPrivateDjContent,
  type PersonalFmMode,
} from "../api/privateDj.ts";
import type { PrivateDjItem } from "../api/types.ts";
import { usePlayerStore } from "../store/playerStore";
import { sizedImage } from "../utils/image";
import { LoadingState, Page, PageHeader } from "./Page";
import SongList from "./SongList";

export default function PrivateDjPage() {
  const [items, setItems] = useState<PrivateDjItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fmMode, setFmMode] = useState<PersonalFmMode>("DEFAULT");
  const [fmSongs, setFmSongs] = useState<NonNullable<PrivateDjItem["song"]>[]>(
    [],
  );
  const [fmLoading, setFmLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await getPrivateDjContent());
    } catch (cause) {
      setItems([]);
      setError(cause instanceof Error ? cause.message : "私人 DJ 加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const loadFmMode = async (mode: PersonalFmMode) => {
    setFmMode(mode);
    setFmLoading(true);
    try {
      setFmSongs(await getPersonalFmByMode(mode));
    } catch {
      setFmSongs([]);
      usePlayerStore.getState().toast("私人 FM 模式加载失败", "error");
    } finally {
      setFmLoading(false);
    }
  };

  const songs = useMemo(
    () =>
      items
        .map((item) => item.song)
        .filter((song): song is NonNullable<typeof song> => song !== null),
    [items],
  );
  const programs = items.filter((item) => item.kind === "program");

  return (
    <Page>
      <PageHeader
        title="私人 DJ"
        subtitle="为你推荐 DJ 声音与歌曲"
        actions={
          <button
            className="icon-button"
            title="刷新私人 DJ"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={17} className={loading ? "spin" : ""} />
          </button>
        }
      />
      {loading ? (
        <LoadingState label="正在加载私人 DJ…" />
      ) : items.length ? (
        <>
          <section className="private-dj-mode-panel">
            <div className="list-header">
              <h3>私人 FM 模式</h3>
              <select
                value={fmMode}
                onChange={(event) =>
                  void loadFmMode(event.target.value as PersonalFmMode)
                }
                disabled={fmLoading}
              >
                <option value="DEFAULT">默认</option>
                <option value="FAMILIAR">熟悉</option>
                <option value="EXPLORE">探索</option>
                <option value="SCENE_RCMD">场景推荐</option>
                <option value="aidj">AI DJ</option>
              </select>
            </div>
            {fmLoading ? (
              <LoadingState label="正在切换 FM 模式…" />
            ) : (
              <SongList songs={fmSongs} emptyText="选择模式加载歌曲" />
            )}
          </section>
          {songs.length > 0 && (
            <SongList songs={songs} title="推荐歌曲" emptyText="暂无推荐歌曲" />
          )}
          {programs.length > 0 && (
            <section className="private-dj-section">
              <div className="list-header">
                <h3>
                  <Mic2 size={16} /> DJ 声音
                </h3>
                <span className="count">{programs.length} 条</span>
              </div>
              <div className="private-dj-grid">
                {programs.map((item) => (
                  <article className="private-dj-card" key={item.id}>
                    {item.coverUrl ? (
                      <img
                        src={sizedImage(item.coverUrl, 240)}
                        alt=""
                        loading="lazy"
                      />
                    ) : (
                      <span className="private-dj-cover">
                        <Headphones size={22} />
                      </span>
                    )}
                    <div className="private-dj-copy">
                      <strong>{item.title}</strong>
                      <span>{item.subtitle || "私人 DJ 推荐"}</span>
                      {item.audioUrl && (
                        <audio controls preload="none" src={item.audioUrl} />
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="private-dj-empty">
          <Headphones size={24} />
          <strong>暂无私人 DJ 推荐</strong>
        </div>
      )}
      {error && (
        <div className="private-dj-error" role="alert">
          {error}
        </div>
      )}
    </Page>
  );
}
