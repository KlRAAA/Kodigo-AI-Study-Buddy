"use client";

import { Check, Copy, Globe, KeyRound, Link2, Loader2, Lock, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ErrorMessage } from "@/components/form";
import { Alert, Button, Input, Label, Segmented } from "@/components/ui";
import { setHandleAction, shareSetAction } from "@/server/actions/sharing";
import type { ErrorCode } from "@/server/actions/result";
import type { ModerationStatus, Visibility } from "@/server/db/schema";

type Props = {
  setId: string;
  visibility: Visibility;
  status: ModerationStatus;
  reasonCategories: string[];
  /** Absolute share link, built on the server so it renders the same on both sides. */
  shareUrl: string | null;
  handle: string | null;
};

export function SharePanel({ setId, visibility, status, reasonCategories, shareUrl: link, handle: initialHandle }: Props) {
  const t = useTranslations("share");
  const router = useRouter();
  const [handle, setHandle] = useState(initialHandle);
  const [handleDraft, setHandleDraft] = useState("");
  const [choice, setChoice] = useState<Visibility>(visibility);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const isLive = visibility !== "private" && status === "approved";
  const code = link ? link.slice(link.lastIndexOf("/") + 1) : null;
  const [codeCopied, setCodeCopied] = useState(false);

  function apply(next: Visibility) {
    setError(null);
    startTransition(async () => {
      const res = await shareSetAction(setId, next);
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  }

  if (!handle) {
    return (
      <section className="space-y-3 rounded-3xl border border-border bg-surface p-5">
        <h2 className="font-black">{t("title")}</h2>
        <p className="text-sm text-muted">{t("pickHandle")}</p>
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await setHandleAction(handleDraft);
              if (res.ok) setHandle(res.data.handle);
              else setError(res.error);
            });
          }}
        >
          <Label htmlFor="handle">{t("username")}</Label>
          <div className="flex gap-2">
            <Input id="handle" value={handleDraft} onChange={(e) => setHandleDraft(e.target.value)} placeholder="juan_dc" autoCapitalize="off" autoCorrect="off" maxLength={20} />
            <Button type="submit" variant="secondary" className="shrink-0 whitespace-nowrap" disabled={pending || handleDraft.trim().length < 3}>
              {t("saveHandle")}
            </Button>
          </div>
        </form>
        <ErrorMessage code={error} />
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-3xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-black">{t("title")}</h2>
        <span className="text-sm text-muted">@{handle}</span>
      </div>
      <Segmented
        label={t("title")}
        value={choice}
        onChange={(v) => setChoice(v)}
        options={[
          { value: "private", label: t("private") },
          { value: "link", label: t("link") },
          { value: "public", label: t("public") },
        ]}
      />
      <p className="flex items-start gap-2 text-sm text-muted">
        {choice === "private" ? <Lock aria-hidden className="mt-0.5 size-4 shrink-0" /> : choice === "link" ? <Link2 aria-hidden className="mt-0.5 size-4 shrink-0" /> : <Globe aria-hidden className="mt-0.5 size-4 shrink-0" />}
        {t(`${choice}Hint`)}
      </p>
      {choice !== visibility && (
        <Button className="w-full" disabled={pending} onClick={() => apply(choice)}>
          {pending ? <Loader2 aria-hidden className="size-5 animate-spin" /> : null}
          {pending && choice !== "private" ? t("checking") : t("apply")}
        </Button>
      )}
      {choice !== "private" && choice === visibility && (
        <p className="text-xs text-muted">
          {t.rich("rulesNote", { link: (c) => <Link href="/guidelines" className="underline">{c}</Link> })}
        </p>
      )}

      {status === "stale" && visibility !== "private" && (
        <div className="space-y-2">
          <Alert tone="info">{t("staleNotice")}</Alert>
          <Button variant="accent" className="w-full" disabled={pending} onClick={() => apply(visibility)}>
            <RefreshCw aria-hidden className="size-5" /> {pending ? t("checking") : t("publishChanges")}
          </Button>
        </div>
      )}
      {status === "review" && visibility !== "private" && <Alert tone="info">{t("reviewNotice")}</Alert>}
      {status === "blocked" && (
        <Alert>
          {t("blockedNotice")}{" "}
          {reasonCategories.map((c) => (t.has(`categories.${c}`) ? t(`categories.${c}`) : c)).join(", ")}
        </Alert>
      )}
      {status === "taken_down" && <Alert>{t("takenDownNotice")}</Alert>}

      {isLive && link && (
        <div className="space-y-2">
          {/* The whole link, wrapped, so it's clear it points to this set and not just the app. */}
          <p
            aria-label={t("shareLink")}
            className="rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm font-semibold break-all select-all"
          >
            {link}
          </p>
          <Button
            variant="secondary"
            className="w-full"
            onClick={async () => {
              try {
                if (navigator.share) await navigator.share({ url: link });
                else await navigator.clipboard.writeText(link);
                setCopied(true);
              } catch {
                // user cancelled the share sheet
              }
            }}
          >
            {copied ? <Check aria-hidden className="size-5" /> : <Copy aria-hidden className="size-5" />}
            {copied ? t("copied") : t("copyLink")}
          </Button>
          {code && (
            // Short code people can paste into "Add by code" on Home or Explore.
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface-2 p-2 pl-4">
              <KeyRound aria-hidden className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-muted">{t("codeLabel")}</span>
                <span className="font-mono text-lg font-bold tracking-wider select-all">{code}</span>
              </span>
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(code);
                    setCodeCopied(true);
                  } catch {
                    // clipboard blocked; the code is selectable
                  }
                }}
              >
                {codeCopied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
                {codeCopied ? t("copied") : t("copyCode")}
              </Button>
            </div>
          )}
        </div>
      )}
      <ErrorMessage code={error} />
    </section>
  );
}
