import { useEffect, useRef } from "react";

/**
 * 滚动到哨兵元素附近时自动触发加载更多。
 * disabled 传 true（正在加载或没有更多）时停止监听，防止重复请求。
 * 返回哨兵元素的 ref，挂在列表末尾的占位 div 上。
 */
export function useInfiniteScroll(onLoadMore: () => void, disabled: boolean) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadRef = useRef(onLoadMore);
  loadRef.current = onLoadMore;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || disabled) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadRef.current();
        }
      },
      // 提前 200px 触发，让加载在用户看到底部之前开始
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [disabled]);

  return sentinelRef;
}
