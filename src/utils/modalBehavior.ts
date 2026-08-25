import { useEffect, useRef, type RefObject } from "react";

type ModalEntry = {
  close: () => void;
  surface: HTMLElement | null;
};

const modalStack: ModalEntry[] = [];
let listenerInstalled = false;
let scrollLockCount = 0;
let previousOverflow = "";

function focusable(surface: HTMLElement): HTMLElement[] {
  return Array.from(
    surface.querySelectorAll<HTMLElement>(
      "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
    ),
  ).filter((element) => element.getAttribute("aria-hidden") !== "true");
}

function onKeyDown(event: KeyboardEvent) {
  const current = modalStack[modalStack.length - 1];
  if (!current) return;

  if (event.key === "Escape") {
    event.preventDefault();
    current.close();
    return;
  }

  if (event.key !== "Tab" || !current.surface) return;
  const items = focusable(current.surface);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function updateListener() {
  if (modalStack.length && !listenerInstalled) {
    document.addEventListener("keydown", onKeyDown);
    listenerInstalled = true;
  } else if (!modalStack.length && listenerInstalled) {
    document.removeEventListener("keydown", onKeyDown);
    listenerInstalled = false;
  }
}

function lockScroll() {
  if (scrollLockCount++ === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
}

function unlockScroll() {
  if (scrollLockCount === 0 || --scrollLockCount > 0) return;
  document.body.style.overflow = previousOverflow;
  previousOverflow = "";
}

export function useModalBehavior<T extends HTMLElement>(
  open: boolean,
  surfaceRef: RefObject<T | null>,
  onClose: () => void,
  initialFocusRef?: RefObject<HTMLElement | null>,
) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const entry: ModalEntry = {
      close: () => closeRef.current(),
      surface: surfaceRef.current,
    };
    modalStack.push(entry);
    lockScroll();
    updateListener();

    const frame = window.requestAnimationFrame(() => {
      const target =
        initialFocusRef?.current ??
        (surfaceRef.current ? focusable(surfaceRef.current)[0] : undefined);
      target?.focus();
      entry.surface = surfaceRef.current;
    });

    return () => {
      window.cancelAnimationFrame(frame);
      const index = modalStack.indexOf(entry);
      if (index >= 0) modalStack.splice(index, 1);
      updateListener();
      unlockScroll();
      if (previousFocusRef.current?.isConnected)
        previousFocusRef.current.focus();
    };
  }, [initialFocusRef, open, surfaceRef]);
}
