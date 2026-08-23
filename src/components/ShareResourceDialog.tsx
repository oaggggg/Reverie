import { useEffect, useState } from "react";
import { Send, X } from "lucide-react";
import { shareResource } from "../api/share";
import type { Song } from "../api/types";
import { usePlayerStore } from "../store/playerStore";

export default function ShareResourceDialog({ song, open, onClose }: { song: Song | null; open: boolean; onClose: () => void }) {
  const toast = usePlayerStore((state) => state.toast);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  useEffect(() => { if (open) setMessage(""); }, [open, song?.id]);
  if (!open || !song) return null;
  const submit = async () => {
    if (sending) return;
    setSending(true);
    try {
      await shareResource("song", song.id, message);
      toast("已分享到动态", "success");
      onClose();
    } catch {
      toast("分享失败", "error");
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="modal-backdrop share-dialog-backdrop" onClick={onClose}>
      <section className="modal share-dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header className="modal-head"><div><h2>分享歌曲</h2><p>{song.name} · {song.artists}</p></div><button className="icon-btn" onClick={onClose} title="关闭"><X size={18} /></button></header>
        <textarea value={message} maxLength={140} placeholder="写点分享说明（可选）" onChange={(event) => setMessage(event.target.value)} />
        <div className="share-dialog-footer"><span>{message.length}/140</span><button className="btn primary" onClick={() => void submit()} disabled={sending}><Send size={14} /> {sending ? "分享中…" : "分享到动态"}</button></div>
      </section>
    </div>
  );
}
