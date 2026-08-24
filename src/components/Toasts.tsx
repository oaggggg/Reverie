import { usePlayerStore } from "../store/playerStore";
import { BadgeCheck, CircleAlert, Info } from "lucide-react";

const META = {
  info: <Info size={17} />,
  success: <BadgeCheck size={17} />,
  error: <CircleAlert size={17} />,
};

export default function Toasts() {
  const toasts = usePlayerStore((s) => s.toasts);
  if (!toasts.length) return null;
  const visibleToasts = toasts.slice(-5);
  return (
    <div className="toast-wrap">
      {visibleToasts.map((t, index) => (
        <div
          key={t.id}
          className={`toast ${t.type}${t.exiting ? " is-exiting" : ""}`}
          data-stack-index={index}
          style={{ top: `calc(-8px * ${visibleToasts.length - 1 - index})` }}
          role="status"
        >
          <span className="toast-icon">{META[t.type]}</span>
          <div className="toast-copy">
            <span>{t.text}</span>
          </div>
          <i className="toast-life" />
        </div>
      ))}
    </div>
  );
}
