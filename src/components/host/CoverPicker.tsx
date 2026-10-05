"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  COVER_ACCEPT,
  COVER_MAX_SOURCE_BYTES,
  cropRect,
  loadImage,
  renderCover,
  uploadCover,
  type LoadedImage,
} from "@/lib/cover-image";
import { CoverImage } from "@/components/CoverImage";
import { TextField } from "@/components/TextField";
import { Button, Spinner, cx } from "@/components/ui";

/**
 * The event cover field (#37). Pick → frame it 16:9 → upload, or keep the
 * cover the draft already has.
 *
 * Framing is one slider, not a free-form crop box: a 16:9 window over any
 * photo only ever has slack along ONE axis, so "slide it up or down" (or
 * left/right) is the whole crop, and it works with a thumb on a phone.
 *
 * The upload happens on "Use this cover", not on submit, so the form never
 * submits with a cover still in flight, and a failure is shown right here.
 * `onPendingChange` tells the form a picked image hasn't been confirmed.
 *
 * If uploads aren't configured on this deployment (503), the field offers a
 * plain image link instead — `coverImage` is just a URL to the API.
 */
export function CoverPicker({
  value,
  onChange,
  onPendingChange,
  disabled = false,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  onPendingChange?: (pending: boolean) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [focus, setFocus] = useState(0.5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState(false);
  const [link, setLink] = useState("");

  // Free the object URL when the picked image goes away.
  useEffect(() => () => {
    if (image) URL.revokeObjectURL(image.previewUrl);
  }, [image]);

  useEffect(() => {
    onPendingChange?.(!!image);
  }, [image, onPendingChange]);

  async function pick(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!COVER_ACCEPT.split(",").includes(file.type)) {
      setError("Choose a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > COVER_MAX_SOURCE_BYTES) {
      setError("That image is over 25MB. Choose a smaller one.");
      return;
    }
    try {
      const loaded = await loadImage(file);
      if (loaded.width < 640 || loaded.height < 360) {
        URL.revokeObjectURL(loaded.previewUrl);
        setError("That image is too small for a cover. Use one at least 1280 pixels wide.");
        return;
      }
      setFocus(0.5);
      setImage(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That file couldn't be opened.");
    }
  }

  async function confirm() {
    if (!image) return;
    setBusy(true);
    setError(null);
    try {
      const url = await uploadCover(await renderCover(image, focus));
      onChange(url);
      setImage(null);
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(err instanceof Error ? err.message : "Couldn't upload the cover.");
      if (status === 503) setLinkMode(true);
    } finally {
      setBusy(false);
    }
  }

  function chooseFile() {
    if (fileRef.current) {
      fileRef.current.value = "";
      fileRef.current.click();
    }
  }

  const axis = image ? cropRect(image.width, image.height, focus).axis : "y";
  const objectPosition = axis === "x" ? `${focus * 100}% 50%` : `50% ${focus * 100}%`;

  return (
    <div className="flex flex-col gap-3">
      <span id={`${inputId}-label`} className="text-label text-text-dim">
        Cover image <span className="text-text-faint">· optional, 16:9</span>
      </span>
      <input
        ref={fileRef}
        id={inputId}
        type="file"
        accept={COVER_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-labelledby={`${inputId}-label`}
        onChange={(e) => void pick(e.target.files?.[0])}
      />

      {image ? (
        <div className="flex flex-col gap-3">
          <div className="relative aspect-video overflow-hidden rounded-card border border-border bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL */}
            <img
              src={image.previewUrl}
              alt="Your cover, as it will be cropped"
              className="size-full object-cover"
              style={{ objectPosition }}
            />
            {busy ? (
              <div className="absolute inset-0 grid place-items-center bg-black/50">
                <Spinner className="size-6 text-text" />
              </div>
            ) : null}
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-helper text-text-faint">
              Slide to frame it — {axis === "x" ? "left or right" : "up or down"}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(focus * 100)}
              onChange={(e) => setFocus(Number(e.target.value) / 100)}
              disabled={busy}
              className="h-10 w-full accent-accent"
              aria-label={`Frame the cover ${axis === "x" ? "left to right" : "top to bottom"}`}
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" size="sm" disabled={busy || disabled} onClick={() => void confirm()} className="w-full sm:w-auto">
              {busy ? <Spinner /> : null}
              {busy ? "Uploading…" : "Use this cover"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setImage(null);
                setError(null);
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : value ? (
        <div className="flex flex-col gap-3">
          <div className="relative aspect-video overflow-hidden rounded-card border border-border">
            <CoverImage src={value} sizes="(min-width: 640px) 560px, 100vw" />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={chooseFile} className="w-full sm:w-auto">
              Change cover
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onChange(null)} className="w-full sm:w-auto">
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={chooseFile}
          disabled={disabled}
          className={cx(
            "flex aspect-video flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border-strong bg-surface px-4 text-center transition-colors",
            "hover:border-accent hover:bg-accent-tint disabled:opacity-60",
          )}
        >
          <span className="text-body font-bold text-text">Add a cover</span>
          <span className="text-helper text-text-faint">JPEG, PNG or WebP · landscape works best</span>
        </button>
      )}

      {error ? (
        <p role="alert" className="text-helper text-danger">
          {error}
        </p>
      ) : null}

      {linkMode && !image ? (
        <div className="flex flex-col gap-2">
          <TextField
            label="Or paste an image link"
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            disabled={disabled}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled || !/^https:\/\/\S+$/i.test(link.trim())}
            onClick={() => {
              onChange(link.trim());
              setLink("");
              setLinkMode(false);
              setError(null);
            }}
            className="w-full sm:w-fit"
          >
            Use this link
          </Button>
        </div>
      ) : null}
    </div>
  );
}
