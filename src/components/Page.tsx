import {
  useCallback,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type UIEvent,
} from "react";
import { usePlayerStore } from "../store/playerStore";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div className="page-heading">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Page({ children }: { children: ReactNode }) {
  const activeView = usePlayerStore((s) => s.activeView);
  const savedTop = usePlayerStore(
    (s) => s.viewScrollPositions[activeView] ?? 0,
  );
  const saveViewScroll = usePlayerStore((s) => s.saveViewScroll);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef(0);

  const publishScroll = useCallback((scrollTop: number) => {
    window.cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent("reverie:page-scroll", { detail: { scrollTop } }),
      );
    });
  }, []);

  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = savedTop;
    publishScroll(savedTop);
    return () => {
      window.cancelAnimationFrame(scrollFrameRef.current);
      saveViewScroll(activeView, node.scrollTop);
    };
  }, [activeView, publishScroll, savedTop, saveViewScroll]);

  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      publishScroll(event.currentTarget.scrollTop);
    },
    [publishScroll],
  );

  return (
    <div className="page">
      <div className="page-scroll" ref={scrollRef} onScroll={handleScroll}>
        {children}
      </div>
    </div>
  );
}

export function LoadingState({ label = "加载中…" }: { label?: string }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
