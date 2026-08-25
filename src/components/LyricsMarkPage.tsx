import { useEffect, useRef, useState } from "react";
import { BookOpenText, Clock3, RefreshCw, Search, Trash2 } from "lucide-react";
import { useLyricsMarkStore } from "../store/lyricsMarkStore.ts";
import { usePlayerStore } from "../store/playerStore.ts";
import { LoadingState, Page, PageHeader } from "./Page";

export default function LyricsMarkPage() {
  const currentSong = usePlayerStore((state) => state.currentSong);
  const songId = useLyricsMarkStore((state) => state.songId);
  const songName = useLyricsMarkStore((state) => state.songName);
  const songMarks = useLyricsMarkStore((state) => state.songMarks);
  const userMarks = useLyricsMarkStore((state) => state.userMarks);
  const loading = useLyricsMarkStore((state) => state.loading);
  const saving = useLyricsMarkStore((state) => state.saving);
  const error = useLyricsMarkStore((state) => state.error);
  const setSong = useLyricsMarkStore((state) => state.setSong);
  const loadSongMarks = useLyricsMarkStore((state) => state.loadSongMarks);
  const loadUserMarks = useLyricsMarkStore((state) => state.loadUserMarks);
  const add = useLyricsMarkStore((state) => state.add);
  const remove = useLyricsMarkStore((state) => state.remove);
  const [original, setOriginal] = useState("");
  const [translation, setTranslation] = useState("");
  const [timestamp, setTimestamp] = useState("0");

  useEffect(() => {
    void loadUserMarks();
  }, [loadUserMarks]);
  const autoFilledRef = useRef(songId !== 0);
  useEffect(() => {
    if (autoFilledRef.current || !currentSong) return;
    autoFilledRef.current = true;
    setSong(currentSong.id, currentSong.name);
  }, [currentSong, setSong]);

  const submit = async () => {
    // 保存失败时保留用户输入，避免刚写的歌词文本丢失。
    const ok = await add({
      startTimeStamp: Number(timestamp) || 0,
      originalLyricsText: original,
      translateLyricsText: translation,
    });
    if (ok) {
      setOriginal("");
      setTranslation("");
    }
  };

  return (
    <Page>
      <PageHeader
        title="我的歌词本"
        subtitle="保存、管理和删除歌词摘录"
        actions={
          <button
            className="icon-button"
            title="刷新"
            onClick={() => {
              void loadSongMarks();
              void loadUserMarks();
            }}
          >
            <RefreshCw size={17} />
          </button>
        }
      />
      <div className="lyrics-mark-layout">
        <section className="lyrics-mark-panel">
          <div className="lyrics-mark-section-head">
            <div>
              <h2>歌曲摘录</h2>
              <span>{songName || "按歌曲 ID 查询"}</span>
            </div>
            <BookOpenText size={18} />
          </div>
          <div className="lyrics-mark-song-form">
            <div className="lyrics-mark-song-input">
              <Search size={15} />
              <input
                value={songId || ""}
                inputMode="numeric"
                onChange={(event) => setSong(Number(event.target.value) || 0)}
                placeholder="歌曲 ID"
              />
              <button
                className="secondary-button"
                onClick={() => void loadSongMarks()}
              >
                查询
              </button>
            </div>
          </div>
          {loading && !songMarks.length ? (
            <LoadingState label="正在加载摘录…" />
          ) : songMarks.length ? (
            <div className="lyrics-mark-list">
              {songMarks.map((mark) => (
                <MarkRow
                  key={mark.id}
                  mark={mark}
                  onRemove={() => void remove(mark)}
                  disabled={saving}
                />
              ))}
            </div>
          ) : (
            <div className="lyrics-mark-empty">暂无歌曲摘录</div>
          )}
          <div className="lyrics-mark-add">
            <h3>添加摘录</h3>
            <div className="lyrics-mark-input-row">
              <input
                value={timestamp}
                onChange={(event) => setTimestamp(event.target.value)}
                inputMode="numeric"
                placeholder="时间戳（毫秒）"
              />
              <input
                value={original}
                onChange={(event) => setOriginal(event.target.value)}
                placeholder="原文歌词"
              />
            </div>
            <input
              value={translation}
              onChange={(event) => setTranslation(event.target.value)}
              placeholder="翻译（可选）"
            />
            <button
              className="primary-button"
              onClick={() => void submit()}
              disabled={saving}
            >
              <BookOpenText size={15} />
              保存摘录
            </button>
          </div>
        </section>
        <section className="lyrics-mark-panel">
          <div className="lyrics-mark-section-head">
            <div>
              <h2>我的摘录</h2>
              <span>{userMarks.length} 条</span>
            </div>
            <Clock3 size={18} />
          </div>
          {loading && !userMarks.length ? (
            <LoadingState label="正在加载歌词本…" />
          ) : userMarks.length ? (
            <div className="lyrics-mark-list">
              {userMarks.map((mark) => (
                <MarkRow
                  key={mark.id}
                  mark={mark}
                  onRemove={() => void remove(mark)}
                  disabled={saving}
                />
              ))}
            </div>
          ) : (
            <div className="lyrics-mark-empty">还没有保存的摘录</div>
          )}
        </section>
      </div>
      {error && (
        <div className="lyrics-mark-error" role="alert">
          {error}
        </div>
      )}
    </Page>
  );
}

function MarkRow({
  mark,
  onRemove,
  disabled,
}: {
  mark: {
    id: string;
    songId: number;
    songName: string;
    originalLyricsText: string;
    translateLyricsText: string;
    startTimeStamp: number;
  };
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <article className="lyrics-mark-row">
      <div className="lyrics-mark-row-copy">
        <strong>{mark.songName || `歌曲 ${mark.songId}`}</strong>
        <span>{mark.originalLyricsText}</span>
        {mark.translateLyricsText && <small>{mark.translateLyricsText}</small>}
        <time>{mark.startTimeStamp} ms</time>
      </div>
      <button
        className="icon-button danger"
        title="删除摘录"
        onClick={onRemove}
        disabled={disabled}
      >
        <Trash2 size={15} />
      </button>
    </article>
  );
}
