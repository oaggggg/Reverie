import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption { value: string; label: string; disabled?: boolean }

export default function StyledSelect({
  value, options, onChange, disabled = false, title, className = "",
}: {
  value: string; options: SelectOption[]; onChange: (value: string) => void;
  disabled?: boolean; title?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];
  useEffect(() => {
    if (!open) return;
    // 菜单会被最近的 overflow 裁剪祖先（如消息中心的 .message-layout
    // overflow:hidden）截断，因此按“裁剪容器内的剩余空间”判断是否向上
    // 展开，而不是只看窗口剩余空间。
    const anchor = ref.current;
    const rect = anchor?.getBoundingClientRect();
    if (anchor && rect) {
      let clipBottom = window.innerHeight;
      let node = anchor.parentElement;
      while (node) {
        const overflowY = getComputedStyle(node).overflowY;
        if (
          overflowY === "hidden" ||
          overflowY === "clip" ||
          overflowY === "auto" ||
          overflowY === "scroll"
        ) {
          clipBottom = Math.min(
            clipBottom,
            node.getBoundingClientRect().bottom,
          );
          break;
        }
        node = node.parentElement;
      }
      setOpenUp(clipBottom - rect.bottom < 300 && rect.top > 300);
    }
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} className={`styled-select ${open ? "open" : ""} ${openUp ? "open-up" : ""} ${className}`} data-disabled={disabled}>
      <button type="button" className="styled-select-trigger" disabled={disabled} title={title} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span>{selected?.label ?? "请选择"}</span><ChevronDown size={15} />
      </button>
      {open && <div className="styled-select-menu" role="listbox">
        {options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} disabled={option.disabled} className={`${option.value === value ? "active" : ""} ${option.disabled ? "locked" : ""}`} onClick={() => { if (option.disabled) return; onChange(option.value); setOpen(false); }}>
          <span>{option.label}</span>{option.value === value && <Check size={14} />}
        </button>)}
      </div>}
    </div>
  );
}
