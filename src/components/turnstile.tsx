"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Cloudflare Turnstile widget. It adds a hidden `cf-turnstile-response` input
 * to the surrounding form, which the server action verifies.
 * The script is loaded (with the CSP nonce) by the auth layout.
 */
export function Turnstile({ siteKey, language }: { siteKey: string | undefined; language: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    const el = ref.current;
    let widgetId: string | undefined;
    let tries = 0;
    const timer = window.setInterval(() => {
      if (window.turnstile && !widgetId) {
        widgetId = window.turnstile.render(el, {
          sitekey: siteKey,
          language: language === "tl" ? "tl" : "en",
          appearance: "interaction-only",
          "response-field-name": "cf-turnstile-response",
        });
        window.clearInterval(timer);
      } else if (++tries > 100) {
        window.clearInterval(timer);
      }
    }, 100);
    return () => {
      window.clearInterval(timer);
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [siteKey, language]);

  if (!siteKey) return null;
  return <div ref={ref} className="min-h-0" />;
}
