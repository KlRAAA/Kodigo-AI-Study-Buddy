"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { canSpeak, speak, stopSpeaking } from "@/lib/speech";
import { cn } from "@/lib/utils";

const subscribe = () => () => {};

/** Reads `text` aloud. Hidden on browsers without speech synthesis. */
export function SpeakButton({ text, className }: { text: string; className?: string }) {
  const t = useTranslations("study");
  const supported = useSyncExternalStore(subscribe, canSpeak, () => false);
  const [speaking, setSpeaking] = useState(false);

  // Stop when the text changes (next card / flip) or the button unmounts.
  useEffect(() => {
    return () => stopSpeaking();
  }, [text]);

  if (!supported) return null;

  return (
    <button
      type="button"
      aria-label={speaking ? t("stopSpeaking") : t("speak")}
      aria-pressed={speaking}
      onClick={(e) => {
        e.stopPropagation();
        if (speaking) {
          stopSpeaking();
          setSpeaking(false);
        } else {
          setSpeaking(true);
          speak(text, () => setSpeaking(false));
        }
      }}
      className={cn(
        "flex size-11 items-center justify-center rounded-full bg-surface/90 text-primary shadow-sm active:scale-95",
        className,
      )}
    >
      {speaking ? <VolumeX aria-hidden className="size-5" /> : <Volume2 aria-hidden className="size-5" />}
    </button>
  );
}
