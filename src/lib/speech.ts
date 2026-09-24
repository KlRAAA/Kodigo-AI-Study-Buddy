// Text-to-speech with the phone's built-in voices (Web Speech API). Free, offline-capable,
// and supported by iOS Safari. Must be started from a tap (iOS requirement).

const TAGALOG_HINTS = /\b(ang|ng|mga|sa|ay|na|nang|ito|iyon|kung|para|hindi|siya|sila|tayo|kami)\b/gi;

/** Rough guess whether a text is Tagalog (enough to pick a voice). */
export function looksTagalog(text: string) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const hits = text.match(TAGALOG_HINTS)?.length ?? 0;
  return words > 0 && hits / words >= 0.15;
}

export function canSpeak() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function pickVoice(lang: "en" | "tl"): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  if (lang === "tl") {
    const fil = voices.find((v) => /^(fil|tl)(-|_|$)/i.test(v.lang));
    if (fil) return fil;
  }
  return (
    voices.find((v) => /^en-(US|PH)/i.test(v.lang) && v.localService) ??
    voices.find((v) => /^en/i.test(v.lang))
  );
}

export function speak(text: string, onEnd?: () => void) {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const lang = looksTagalog(text) ? "tl" : "en";
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(lang);
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? (lang === "tl" ? "fil-PH" : "en-US");
  utterance.rate = 0.95;
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  synth.speak(utterance);
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}
