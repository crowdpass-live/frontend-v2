"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";

/**
 * A modal panel (#15): a bottom sheet on a phone, a centred card from `sm`.
 * Ported from mobile's `ui.js` sheet — chain switch, roster, pickers.
 *
 * One `<dialog>` node in two positions, never two elements. Like
 * `ConfirmDialog` it is opened with `showModal()`, so the browser makes the
 * page inert, keeps focus inside, closes on Escape and returns focus to the
 * trigger — no focus-trap library. A tap on the backdrop closes it too.
 *
 * For a yes/no on something irreversible, use `ConfirmDialog` instead.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // The dialog box fills the backdrop's padding box, so a click whose
      // target is the dialog itself landed outside the panel.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={
        "m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-card border border-border bg-surface p-0 text-text shadow-2xl " +
        "backdrop:bg-black/70 backdrop:backdrop-blur-sm " +
        "sm:m-auto sm:w-[min(32rem,calc(100vw-2rem))] sm:rounded-card"
      }
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <h2 id={titleId} className="text-section font-bold text-text">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 grid size-10 place-items-center rounded-full text-text-dim transition-colors hover:text-text"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </dialog>
  );
}
