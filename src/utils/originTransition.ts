import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

interface OriginRect {
  left: number;
  top: number;
  width: number;
  height: number;
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
              "button, a, [role='button'], [role='menuitem'], .song-card",
            )
          : null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      originGlobal.__reverieLastInteractionOrigin = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    },
    true,
  );
}

export function captureInteractionOrigin(key: string, element: Element) {
  const rect = element.getBoundingClientRect();
  const origin = {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
  origins.set(key, origin);
  originGlobal.__reverieLastInteractionOrigin = origin;
}

export function capturePointerOrigin(key: string, x: number, y: number) {
  const origin = { left: x, top: y, width: 1, height: 1 };
  origins.set(key, origin);
  originGlobal.__reverieLastInteractionOrigin = origin;
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

  useEffect(() => {
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
  }, [duration, open, rendered]);

  useLayoutEffect(() => {
    if (!rendered) return;
    const surface = surfaceRef.current;
    const origin =
      origins.get(key) ?? originGlobal.__reverieLastInteractionOrigin;
    if (!surface || !origin) return;
    if (!origins.has(key)) origins.set(key, origin);
    const target = surface.getBoundingClientRect();
    const originX = origin.left + origin.width / 2;
    const originY = origin.top + origin.height / 2;
    const targetX = target.left + target.width / 2;
    const targetY = target.top + target.height / 2;
    surface.style.setProperty("--origin-x", `${originX - targetX}px`);
    surface.style.setProperty("--origin-y", `${originY - targetY}px`);
    surface.style.setProperty(
      "--origin-scale-x",
      String(Math.max(0.12, Math.min(0.82, origin.width / target.width))),
    );
    surface.style.setProperty(
      "--origin-scale-y",
      String(Math.max(0.12, Math.min(0.82, origin.height / target.height))),
    );
  }, [key, phase, rendered]);

  return {
    rendered,
    surfaceRef,
    backdropClassName: `origin-backdrop origin-${phase}`,
    surfaceClassName: `origin-surface origin-${phase}`,
  };
}
