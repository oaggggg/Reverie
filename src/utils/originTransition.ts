import { useLayoutEffect, useRef, useState } from "react";

interface OriginRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function rectForOrigin(element: Element): OriginRect {
  // Return to the visible control glyph, rather than the button's hit area.
  const visual = element.querySelector("svg, img") ?? element;
  const rect = visual.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
  };
}

const origins = new Map<string, OriginRect>();
const originGlobal = globalThis as typeof globalThis & {
  __reverieOriginCaptureInstalled?: boolean;
  __reverieLastInteractionOrigin?: OriginRect;
};

if (
  typeof document !== "undefined" &&
  !originGlobal.__reverieOriginCaptureInstalled
) {
  originGlobal.__reverieOriginCaptureInstalled = true;
  document.addEventListener(
    "pointerdown",
    (event) => {
      const target =
        event.target instanceof Element
          ? event.target.closest(
              "[data-origin-key], button, a, [role='button'], [role='menuitem'], [role='tab'], .song-card",
            )
          : null;
      if (!target) return;
      const origin = rectForOrigin(target);
      originGlobal.__reverieLastInteractionOrigin = origin;
      const key = target.getAttribute("data-origin-key");
      if (key) origins.set(key, origin);
    },
    true,
  );
}

export function captureInteractionOrigin(key: string, element: Element) {
  const origin = rectForOrigin(element);
  origins.set(key, origin);
  originGlobal.__reverieLastInteractionOrigin = origin;
}

export function capturePointerOrigin(key: string, x: number, y: number) {
  const origin = { left: x, top: y, width: 1, height: 1 };
  origins.set(key, origin);
  originGlobal.__reverieLastInteractionOrigin = origin;
}

export function getInteractionOrigin(key: string) {
  return origins.get(key) ?? originGlobal.__reverieLastInteractionOrigin;
}

export function useOriginTransition<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  key: string,
  duration = 220,
) {
  const [rendered, setRendered] = useState(open);
  const [phase, setPhase] = useState<"opening" | "open" | "closing">(
    open ? "opening" : "open",
  );
  const surfaceRef = useRef<T>(null);

  // Resolve the visual phase before the browser paints. Using useEffect here
  // lets one frame render with the stale `open`/`closing` class, which is the
  // source of the intermittent flash when a dialog is opened quickly.
  useLayoutEffect(() => {
    let timer = 0;
    if (open) {
      setRendered(true);
      setPhase("opening");
      timer = window.setTimeout(() => setPhase("open"), duration);
    } else if (rendered) {
      setPhase("closing");
      timer = window.setTimeout(() => setRendered(false), duration);
    }
    return () => window.clearTimeout(timer);
  }, [duration, key, open, rendered]);

  useLayoutEffect(() => {
    if (!rendered) return;
    const surface = surfaceRef.current;
    const origin = getInteractionOrigin(key);
    if (!surface || !origin) return;
    if (!origins.has(key)) origins.set(key, origin);
    const target = surface.getBoundingClientRect();
    const originX = origin.left + origin.width / 2;
    const originY = origin.top + origin.height / 2;
    const targetX = target.left + target.width / 2;
    const targetY = target.top + target.height / 2;
    surface.style.setProperty("--origin-x", `${originX - targetX}px`);
    surface.style.setProperty("--origin-y", `${originY - targetY}px`);
    surface.style.setProperty("--origin-left", `${originX}px`);
    surface.style.setProperty("--origin-top", `${originY}px`);
    surface.style.setProperty("--origin-duration", `${duration}ms`);
    surface.style.setProperty(
      "--origin-scale-x",
      String(Math.max(0.12, Math.min(0.82, origin.width / target.width))),
    );
    surface.style.setProperty(
      "--origin-scale-y",
      String(Math.max(0.12, Math.min(0.82, origin.height / target.height))),
    );
  }, [duration, key, phase, rendered]);

  return {
    rendered,
    surfaceRef,
    backdropClassName: `origin-backdrop origin-${phase}`,
    surfaceClassName: `origin-surface origin-${phase}`,
  };
}
