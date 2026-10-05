"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircleIcon, CloseIcon, InfoIcon } from "./icons";
import { cx } from "./ui";

/**
 * Toasts (#16): "something finished, no action needed". Ported from the
 * toast half of `v2-mobile/src/components/feedback.js`.
 *
 * Three feedback surfaces, chosen by purpose — keep the distinction:
 *   Toast         — done, nothing to decide, auto-dismisses
 *   ConfirmDialog — an irreversible yes/no
 *   BusyOverlay   — work in flight, don't touch anything
 *
 * The provider sits in the root `Providers`, outside every route group, as
 * mobile mounts it outside the navigator: the result of an action often
 * lands after the user has navigated away from where they triggered it, and
 * a toast owned by the page would die with it.
 *
 * The live regions are rendered empty from the first paint — a screen reader
 * only announces changes to a region it already knows about.
 */

export type ToastTone = "ok" | "info" | "danger";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

type ShowToast = (message: string, opts?: { tone?: ToastTone; durationMs?: number }) => void;

const ToastContext = createContext<ShowToast | null>(null);

const DEFAULT_MS = 4500;
/** More than this and they stack into a wall over the content. */
const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((all) => all.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ShowToast>(
    (message, { tone = "ok", durationMs = DEFAULT_MS } = {}) => {
      const id = ++nextId.current;
      setItems((all) => [...all, { id, message, tone }].slice(-MAX_VISIBLE));
      timers.current.set(id, window.setTimeout(() => dismiss(id), durationMs));
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  const polite = items.filter((t) => t.tone !== "danger");
  const urgent = items.filter((t) => t.tone === "danger");

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div aria-live="assertive" role="alert" className="flex w-full flex-col items-center gap-2">
          {urgent.map((t) => (
            <ToastCard key={t.id} item={t} onDismiss={dismiss} />
          ))}
        </div>
        <div aria-live="polite" role="status" className="flex w-full flex-col items-center gap-2">
          {polite.map((t) => (
            <ToastCard key={t.id} item={t} onDismiss={dismiss} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const Icon = item.tone === "ok" ? CheckCircleIcon : InfoIcon;
  return (
    <div
      className={cx(
        "toast-enter pointer-events-auto flex w-full max-w-[28rem] items-start gap-3 rounded-card border bg-surface-strong px-4 py-3 shadow-2xl",
        item.tone === "danger" ? "border-danger/40" : "border-border-strong",
      )}
    >
      <Icon
        className={cx(
          "mt-px shrink-0",
          item.tone === "ok" && "text-ok",
          item.tone === "info" && "text-info",
          item.tone === "danger" && "text-danger",
        )}
      />
      <p className="min-w-0 flex-1 text-label text-text">{item.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss"
        className="-my-1 -mr-2 grid size-8 shrink-0 place-items-center rounded-full text-text-faint transition-colors hover:text-text"
      >
        <CloseIcon width={16} height={16} />
      </button>
    </div>
  );
}

/** `const toast = useToast(); toast("Saved")`. Throws outside the provider. */
export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast must be used inside <ToastProvider>");
  return show;
}
