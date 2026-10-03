// src/ui/Actions.tsx
//
// The actions cluster in the top bar. Today it holds the More menu, whose
// one item copies a link to the current moment. The menu closes on Esc
// (focus returns to its button), on Tab, and on a press outside it.

import { useEffect, useId, useRef, useState } from "react";
import { formatMoment } from "../core/moment";
import { LinkIcon, MoreIcon } from "./icons";
import { currentMoment, setUi } from "./runtime";

export function Actions() {
  return (
    <div className="actions" role="group" aria-label="Actions">
      <MoreMenu />
    </div>
  );
}

/** Copies the link with the exact current u, even mid-playback. */
async function copyLink(): Promise<void> {
  const moment = currentMoment();
  if (!moment) return;
  const url = formatMoment(window.location.href, moment);
  try {
    await navigator.clipboard.writeText(url);
    setUi({ toast: { kind: "copied" } });
  } catch {
    setUi({ toast: { kind: "copyFailed", url } });
  }
}

function MoreMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onMenuKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      items[(i + step + items.length) % items.length]?.focus();
    }
  };

  return (
    <div className="more" ref={rootRef}>
      <button
        type="button"
        ref={buttonRef}
        className="actions__btn"
        aria-label="More"
        title="More"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <MoreIcon />
      </button>
      {open && (
        <div className="card menu" role="menu" id={menuId} aria-label="More" onKeyDown={onMenuKey}>
          <button
            type="button"
            role="menuitem"
            className="menu__item"
            onClick={() => {
              close();
              void copyLink();
            }}
          >
            <LinkIcon />
            <span>Copy link</span>
          </button>
        </div>
      )}
    </div>
  );
}
