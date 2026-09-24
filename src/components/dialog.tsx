"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button, Input, Label } from "./ui";

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
};

type PromptOptions = {
  title: string;
  label: string;
  initial?: string;
  maxLength?: number;
  confirmLabel?: string;
};

type Request =
  | ({ kind: "confirm"; resolve: (ok: boolean) => void } & ConfirmOptions)
  | ({ kind: "prompt"; resolve: (value: string | null) => void } & PromptOptions);

/**
 * In-app replacement for window.confirm / window.prompt.
 * Usage: const { confirm, prompt, dialog } = useDialogs(); … render {dialog} once.
 */
export function useDialogs() {
  const [request, setRequest] = useState<Request | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setRequest({ kind: "confirm", resolve, ...opts })),
    [],
  );
  const prompt = useCallback(
    (opts: PromptOptions) => new Promise<string | null>((resolve) => setRequest({ kind: "prompt", resolve, ...opts })),
    [],
  );

  const close = useCallback(
    (result: boolean | string | null) => {
      setRequest((current) => {
        if (current?.kind === "confirm") current.resolve(result === true);
        if (current?.kind === "prompt") current.resolve(typeof result === "string" ? result : null);
        return null;
      });
    },
    [],
  );

  const dialog = request ? <AppDialog key={request.title} request={request} onClose={close} /> : null;
  return { confirm, prompt, dialog };
}

function AppDialog({ request, onClose }: { request: Request; onClose: (result: boolean | string | null) => void }) {
  const t = useTranslations("common");
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const inputId = useId();
  const [value, setValue] = useState(request.kind === "prompt" ? (request.initial ?? "") : "");

  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);

  const trimmed = value.trim();

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose(null);
      }}
      onClick={(e) => {
        // Tapping the dimmed backdrop cancels.
        if (e.target === ref.current) onClose(null);
      }}
      className="app-dialog m-auto w-[min(26rem,calc(100vw-2rem))] rounded-3xl border border-border bg-surface p-0 text-text shadow-2xl"
    >
      <form
        method="dialog"
        className="space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (request.kind === "prompt") {
            if (trimmed) onClose(trimmed);
          } else {
            onClose(true);
          }
        }}
      >
        <h2 id={titleId} className="text-lg font-black">
          {request.title}
        </h2>
        {request.kind === "confirm" && request.message && <p className="text-muted">{request.message}</p>}
        {request.kind === "prompt" && (
          <div>
            <Label htmlFor={inputId}>{request.label}</Label>
            <Input
              id={inputId}
              value={value}
              maxLength={request.maxLength}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => onClose(null)}>
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            variant={request.kind === "confirm" && request.danger ? "danger" : "primary"}
            className="flex-1"
            disabled={request.kind === "prompt" && !trimmed}
            autoFocus={request.kind === "confirm"}
          >
            {request.confirmLabel ?? t("ok")}
          </Button>
        </div>
      </form>
    </dialog>
  );
}

/** Small inline error under a form field. */
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm font-semibold text-danger">
      {children}
    </p>
  );
}
