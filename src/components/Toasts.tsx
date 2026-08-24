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
  return (
    <div className="toast-wrap">
      {toasts.slice(-5).reverse().map((t, index) => (
        <div
          key={t.id}
          className={`toast ${t.type}`}
          data-stack-index={index}
          style={{ top: `calc(38px * ${index})` }}
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
