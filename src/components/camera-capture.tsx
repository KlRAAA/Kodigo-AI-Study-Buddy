"use client";

import { Camera, Check, ImagePlus, Loader2, SwitchCamera, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { compressImage } from "@/lib/image-compress";
import { Button } from "./ui";

type CameraError = "denied" | "unavailable" | "failed";

/** True when the browser can show a live camera (needs HTTPS or localhost). */
export function canUseLiveCamera() {
  return typeof window !== "undefined" && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
}

/**
 * Full-screen live camera. The browser asks for permission when it opens.
 * Each snap is compressed like uploaded photos (≤1600px JPEG) and handed back.
 */
export function CameraCapture({
  remaining,
  onCapture,
  onClose,
  onFallback,
}: {
  remaining: number;
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
  /** Open the phone's own camera/file picker instead. */
  onFallback: () => void;
}) {
  const t = useTranslations("camera");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [error, setError] = useState<CameraError | null>(null);
  const [ready, setReady] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [flash, setFlash] = useState(false);
  const [taken, setTaken] = useState(0);

  useEffect(() => {
    const el = dialogRef.current;
    if (el && !el.open) el.showModal();
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((err: unknown) => {
        const name = err instanceof DOMException ? err.name : "";
        setError(
          name === "NotAllowedError" || name === "SecurityError"
            ? "denied"
            : name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError"
              ? "unavailable"
              : "failed",
        );
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [facing]);

  const left = remaining - taken;

  async function snap() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || left <= 0) return;
    setSnapping(true);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 150);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (blob) {
        onCapture(await compressImage(blob));
        setTaken((n) => n + 1);
      }
    } finally {
      setSnapping(false);
    }
    if (left - 1 <= 0) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label={t("title")}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="app-dialog m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0 text-white"
    >
      <div className="pt-safe pb-safe relative flex h-full flex-col">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="flex size-11 items-center justify-center rounded-full bg-white/15"
          >
            <X aria-hidden className="size-6" />
          </button>
          <p className="text-sm font-bold" aria-live="polite">
            {t("count", { taken, max: remaining })}
          </p>
          <button
            type="button"
            onClick={() => {
              setReady(false);
              setFacing((f) => (f === "environment" ? "user" : "environment"));
            }}
            aria-label={t("switch")}
            disabled={!!error}
            className="flex size-11 items-center justify-center rounded-full bg-white/15 disabled:opacity-40"
          >
            <SwitchCamera aria-hidden className="size-6" />
          </button>
        </div>

        <div className="relative flex-1 overflow-hidden">
          {error ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <Camera aria-hidden className="size-12 opacity-70" />
              <p className="font-bold">{t(`error.${error}`)}</p>
              <Button variant="secondary" onClick={onFallback}>
                <ImagePlus aria-hidden className="size-5" /> {t("fallback")}
              </Button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={() => setReady(true)}
                className="h-full w-full object-contain"
              />
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center" role="status">
                  <Loader2 aria-hidden className="size-10 animate-spin opacity-80" />
                  <span className="sr-only">{t("starting")}</span>
                </div>
              )}
              {flash && <div aria-hidden className="absolute inset-0 bg-white/70" />}
            </>
          )}
        </div>

        {!error && (
          <div className="flex items-center justify-center gap-8 px-4 py-5">
            <span className="w-20" />
            <button
              type="button"
              onClick={snap}
              disabled={!ready || snapping || left <= 0}
              aria-label={t("snap")}
              className="size-18 rounded-full border-4 border-white bg-white/25 transition-transform active:scale-90 disabled:opacity-40"
            />
            <Button
              variant="secondary"
              size="sm"
              className="w-20"
              onClick={onClose}
              disabled={taken === 0}
            >
              <Check aria-hidden className="size-4" /> {t("done")}
            </Button>
          </div>
        )}
      </div>
    </dialog>
  );
}
