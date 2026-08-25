import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { useOriginTransition } from "../utils/originTransition";
import { useModalBehavior } from "../utils/modalBehavior";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: () => boolean | void | Promise<boolean | void>;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "确认删除",
  onClose,
  onConfirm,
}: Props) {
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const transition = useOriginTransition<HTMLDivElement>(open, "confirm", 220);
  useModalBehavior(
    open,
    transition.surfaceRef,
    () => {
      if (!busy) onClose();
    },
    cancelRef,
  );
  useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  if (!transition.rendered) return null;

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await onConfirm();
      if (result !== false) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`modal-backdrop confirm-backdrop ${transition.backdropClassName}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={transition.surfaceRef}
        className={`modal confirm-modal ${transition.surfaceClassName}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        <div className="confirm-head">
          <span className="confirm-icon" aria-hidden="true">
            <AlertTriangle size={20} />
          </span>
          <div className="confirm-copy">
            <h2 id="confirm-title">{title}</h2>
            <p id="confirm-message">{message}</p>
          </div>
          <button
            className="confirm-close"
            onClick={onClose}
            disabled={busy}
            title="关闭"
          >
            <X size={18} />
          </button>
        </div>
        <div className="confirm-actions">
          <button
            ref={cancelRef}
            className="btn"
            onClick={onClose}
            disabled={busy}
          >
            取消
          </button>
          <button
            className="btn danger-solid"
            onClick={() => void confirm()}
            disabled={busy}
          >
            <Trash2 size={15} />
            {busy ? "删除中…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
