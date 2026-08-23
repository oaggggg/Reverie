import { useEffect, useState } from "react";
import type { PlaylistInfo } from "../api/types";
import { useExploreStore } from "../store/exploreStore";
import {
  updatePlaylistCover,
} from "../api/playlistMetadata.ts";
import { usePlayerStore } from "../store/playerStore";
import { useOriginTransition } from "../utils/originTransition";

export default function PlaylistEditorModal({
  playlist,
  open,
  onClose,
}: {
  playlist: PlaylistInfo | null;
  open: boolean;
  onClose: () => void;
}) {
  const createPlaylist = useExploreStore((s) => s.createPlaylist);
  const updatePlaylist = useExploreStore((s) => s.updatePlaylist);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privateList, setPrivateList] = useState(false);
  const [tags, setTags] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const transition = useOriginTransition<HTMLDivElement>(open, "playlist-editor", 220);

  useEffect(() => {
    if (!open) return;
    setName(playlist?.name ?? "");
    setDescription(playlist?.description ?? "");
    setPrivateList(playlist?.privacy === 10);
    setTags(playlist?.tags?.join(", ") ?? "");
    setCover(null);
  }, [open, playlist]);

  if (!transition.rendered) return null;

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    const ok = playlist
      ? await updatePlaylist(
          playlist,
          name,
          description,
          tags,
          playlist.privacy === 10 && !privateList,
        )
      : await createPlaylist(name, privateList ? 10 : 0);
    if (ok && playlist) {
      try {
        if (cover) await updatePlaylistCover(playlist.id, cover);
      } catch {
        usePlayerStore
          .getState()
          .toast("歌单信息已保存，但封面更新失败", "error");
      }
    }
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div className={`modal-backdrop ${transition.backdropClassName}`} onClick={onClose}>
      <div ref={transition.surfaceRef} className={`modal entity-editor ${transition.surfaceClassName}`} onClick={(e) => e.stopPropagation()}>
        <h2>{playlist ? "编辑歌单" : "创建歌单"}</h2>
        <label className="field-label">
          名称
          <input
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {playlist && (
          <label className="field-label">
            标签
            <input
              value={tags}
              maxLength={100}
              placeholder="多个标签用逗号分隔"
              onChange={(e) => setTags(e.target.value)}
            />
          </label>
        )}
        {playlist && (
          <label className="field-label">
            封面
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCover(e.target.files?.[0] ?? null)}
            />
          </label>
        )}
        <label className="field-label">
          描述
          <textarea
            value={description}
            maxLength={1000}
            rows={5}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {(!playlist || playlist.privacy === 10) && (
          <label className="check-row">
            <input
              type="checkbox"
              checked={privateList}
              onChange={(e) => setPrivateList(e.target.checked)}
            />
            {playlist ? "保持为隐私歌单（取消勾选后公开）" : "设为隐私歌单"}
          </label>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button
            className="btn primary"
            disabled={!name.trim() || saving}
            onClick={save}
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
