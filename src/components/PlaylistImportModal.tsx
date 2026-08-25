import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  FileJson,
  Link2,
  LoaderCircle,
  Plus,
  X,
} from "lucide-react";
import {
  createPlaylistImportTask,
  getPlaylistImportTaskStatus,
  type PlaylistImportInput,
} from "../api/playlistImport.ts";
import type { PlaylistImportTaskStatus } from "../api/types.ts";
import { useOriginTransition } from "../utils/originTransition";
import { useModalBehavior } from "../utils/modalBehavior";

type Mode = "text" | "links" | "local";

export default function PlaylistImportModal({
  open,
  onClose,
  onCompleted,
}: {
  open: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}) {
  const [mode, setMode] = useState<Mode>("text");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [task, setTask] = useState<PlaylistImportTaskStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<number | undefined>(undefined);
  const transition = useOriginTransition<HTMLElement>(
    open,
    "playlist-import",
    220,
  );
  useModalBehavior(open, transition.surfaceRef, onClose);

  useEffect(
    () => () => {
      if (timer.current !== undefined) window.clearInterval(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (!open) {
      if (timer.current !== undefined) {
        window.clearInterval(timer.current);
        timer.current = undefined;
      }
      setTask(null);
      setError("");
      setValue("");
      setName("");
      setLoading(false);
    }
  }, [open]);
  if (!transition.rendered) return null;

  const poll = (id: string) => {
    const check = async () => {
      try {
        const next = await getPlaylistImportTaskStatus(id);
        setTask(next);
        if (next.status === "success" || next.status === "failed") {
          if (timer.current !== undefined) window.clearInterval(timer.current);
          timer.current = undefined;
          if (next.status === "success") onCompleted?.();
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "查询导入状态失败");
      }
    };
    void check();
    if (timer.current !== undefined) window.clearInterval(timer.current);
    timer.current = window.setInterval(() => void check(), 3000);
  };

  const submit = async () => {
    const raw = value.trim();
    if (!raw) {
      setError("请输入要导入的内容");
      return;
    }
    let input: PlaylistImportInput;
    if (mode === "text")
      input = {
        kind: "text",
        value: raw,
        playlistName: name.trim() || undefined,
      };
    else if (mode === "links")
      input = {
        kind: "links",
        value: raw
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean),
        playlistName: name.trim() || undefined,
      };
    else {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error("本地数据必须是数组");
        input = {
          kind: "local",
          value: parsed
            .map((item) => {
              const value = item as Record<string, unknown>;
              return {
                name: String(value.name ?? ""),
                artist: String(value.artist ?? value.artists ?? ""),
                album: String(value.album ?? ""),
              };
            })
            .filter((item) => item.name),
        };
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : "本地 JSON 格式错误",
        );
        return;
      }
    }
    setLoading(true);
    setError("");
    try {
      const id = await createPlaylistImportTask(input);
      setTask({ id, status: "pending", progress: 0, message: "任务已创建" });
      poll(id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "创建导入任务失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`modal-backdrop ${transition.backdropClassName}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={transition.surfaceRef}
        className={`playlist-import-modal ${transition.surfaceClassName}`}
        role="dialog"
        aria-modal="true"
        aria-label="导入歌单"
      >
        <header>
          <div>
            <h2>导入歌单</h2>
            <p>创建任务后可查看处理进度。</p>
          </div>
          <button className="icon-button" title="关闭" onClick={onClose}>
            <X size={17} />
          </button>
        </header>
        <div className="playlist-import-tabs" role="tablist">
          <button
            className={mode === "text" ? "active" : ""}
            onClick={() => setMode("text")}
          >
            <Plus size={14} />
            文字
          </button>
          <button
            className={mode === "links" ? "active" : ""}
            onClick={() => setMode("links")}
          >
            <Link2 size={14} />
            链接
          </button>
          <button
            className={mode === "local" ? "active" : ""}
            onClick={() => setMode("local")}
          >
            <FileJson size={14} />
            本地 JSON
          </button>
        </div>
        <input
          className="playlist-import-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="歌单名称（可选）"
        />
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={
            mode === "text"
              ? "输入歌曲文字、歌名或识别文本"
              : mode === "links"
                ? "每行输入一个歌曲或歌单链接"
                : '[{"name":"歌曲","artist":"歌手","album":"专辑"}]'
          }
          rows={7}
        />
        {task && (
          <div className={`playlist-import-status ${task.status}`}>
            <div>
              <strong>
                {task.status === "success"
                  ? "导入完成"
                  : task.status === "failed"
                    ? "导入失败"
                    : "正在导入"}
              </strong>
              <span>{task.message || `任务 ${task.id}`}</span>
            </div>
            {task.status === "success" ? (
              <CheckCircle2 size={19} />
            ) : (
              <LoaderCircle size={19} className="spin" />
            )}
          </div>
        )}
        {error && (
          <div className="playlist-import-error" role="alert">
            {error}
          </div>
        )}
        <footer>
          <button className="secondary-button" onClick={onClose}>
            关闭
          </button>
          <button
            className="primary-button"
            onClick={() => void submit()}
            disabled={
              loading ||
              Boolean(
                task && task.status !== "failed" && task.status !== "success",
              )
            }
          >
            {loading ? "创建中…" : "创建导入任务"}
          </button>
        </footer>
      </section>
    </div>
  );
}
