import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

/** 滚动超过该距离后才浮现按钮（像素）。 */
const SHOW_THRESHOLD = 320;

/**
 * 长列表「回到顶部」悬浮球：作为滚动容器的最后一个子元素使用，
 * 通过 sticky 吸附在可视区右下角（零高度不占布局），滚动超过
 * 阈值后浮现，点击平滑回到顶部。
 */
export default function BackToTop() {
  const dockRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const container = dockRef.current?.parentElement;
    if (!container) return;
    const onScroll = () => setVisible(container.scrollTop > SHOW_THRESHOLD);
    onScroll();
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={dockRef} className="back-to-top-dock">
      <button
        type="button"
        className={`back-to-top ${visible ? "show" : ""}`}
        title="回到顶部"
        aria-label="回到顶部"
        onClick={() =>
          dockRef.current?.parentElement?.scrollTo({
            top: 0,
            behavior: "smooth",
          })
        }
      >
        <ArrowUp size={16} />
      </button>
    </div>
  );
}
