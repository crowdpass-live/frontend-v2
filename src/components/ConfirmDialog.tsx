"use client";

import { useEffect, useId, useRef } from "react";
import { Button, Spinner } from "./ui";

/**
 * A yes/no for an action that is hard or impossible to undo (#16).
 *
 * Built on the native `<dialog>` opened with `showModal()`: the browser
 * makes the rest of the page inert, contains focus, and closes on Escape —
 * no focus-trap library. Focus lands on Cancel, so a reflexive Enter does
 * nothing destructive, and returns to whatever opened it on close.
 *
 * Say exactly what will happen in `children`, consequences included. The
 * confirm button names the action ("Make members-only"), never "OK".
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  /** The safe choice. Rename it when "Cancel" would be ambiguous (cancelling an event). */
  cancelLabel?: string;
  tone?: "default" | "danger";
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Escape fires `cancel`; route it through the caller so state agrees.
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-card border border-border bg-surface p-0 text-text shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 id={titleId} className="text-section font-bold text-text">
          {title}
        </h2>
        <div className="flex flex-col gap-3 text-body text-text-dim">{children}</div>
        {error ? (
          <p role="alert" className="text-label text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            size="sm"
            onClick={onCancel}
            disabled={busy}
            className="w-full sm:w-auto"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={onConfirm}
            disabled={busy}
            className="w-full sm:w-auto"
          >
            {busy ? <Spinner /> : null}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
