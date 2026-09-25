"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useDialogs } from "@/components/dialog";
import { ErrorMessage } from "@/components/form";
import { Button, Input, Label } from "@/components/ui";
import { deleteSetAction, updateSetMetaAction } from "@/server/actions/sets";
import type { ErrorCode } from "@/server/actions/result";

export function SetHeader({ setId, title, subject }: { setId: string; title: string; subject: string }) {
  const t = useTranslations("set");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title, subject });
  const [error, setError] = useState<ErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useDialogs();

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight font-black break-words">{title}</h1>
          {subject && <p className="font-semibold text-muted">{subject}</p>}
        </div>
        <Button variant="ghost" size="sm" aria-label={t("editDetails")} onClick={() => setEditing(true)}>
          <Pencil aria-hidden className="size-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-3xl bg-surface p-4">
      {dialog}
      <div>
        <Label htmlFor="set-title">{t("title")}</Label>
        <Input id="set-title" value={draft.title} maxLength={120} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="set-subject">{t("subject")}</Label>
        <Input id="set-subject" value={draft.subject} maxLength={80} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
      </div>
      <ErrorMessage code={error} />
      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={pending || !draft.title.trim()}
          onClick={() =>
            startTransition(async () => {
              const res = await updateSetMetaAction({ setId, ...draft });
              if (res.ok) {
                setEditing(false);
                router.refresh();
              } else setError(res.error);
            })
          }
        >
          {t("save")}
        </Button>
        <Button variant="secondary" className="flex-1" onClick={() => setEditing(false)}>
          {t("cancel")}
        </Button>
      </div>
      <Button
        variant="ghost"
        className="w-full text-danger"
        disabled={pending}
        onClick={async () => {
          const yes = await confirm({ title: t("trashTitle"), message: t("trashConfirm"), confirmLabel: t("trashButton"), danger: true });
          if (!yes) return;
          startTransition(async () => {
            const res = await deleteSetAction(setId);
            if (res.ok) router.replace("/home");
            else setError(res.error);
          });
        }}
      >
        <Trash2 aria-hidden className="size-5" /> {t("deleteSet")}
      </Button>
    </div>
  );
}
