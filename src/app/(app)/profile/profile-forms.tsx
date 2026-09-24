"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { ErrorMessage } from "@/components/form";
import { Alert, Button, Input, Label } from "@/components/ui";
import { clearOfflineData } from "@/lib/offline-cache";
import { signOutAction } from "@/server/actions/auth";
import { deleteAccountAction, updateDisplayNameAction } from "@/server/actions/profile";
import type { ErrorCode } from "@/server/actions/result";

export function DisplayNameForm({ initial }: { initial: string }) {
  const t = useTranslations("profile");
  const [name, setName] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await updateDisplayNameAction(name);
          setSaved(res.ok);
          setError(res.ok ? null : res.error);
        });
      }}
    >
      <Label htmlFor="display-name">{t("name")}</Label>
      <div className="flex gap-2">
        <Input id="display-name" value={name} maxLength={60} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
        <Button type="submit" variant="secondary" disabled={pending || !name.trim() || name === initial}>
          {t("save")}
        </Button>
      </div>
      {saved && <Alert tone="success">{t("saved")}</Alert>}
      <ErrorMessage code={error} />
    </form>
  );
}

export function SignOutButton() {
  const t = useTranslations("profile");
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="secondary" size="lg" className="w-full" disabled={pending} onClick={() =>
        startTransition(async () => {
          await clearOfflineData();
          await signOutAction();
        })
      }>
      <LogOut aria-hidden className="size-5" /> {t("signOut")}
    </Button>
  );
}

export function DeleteAccount() {
  const t = useTranslations("profile");
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<ErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  const word = t("deleteWord");

  if (!open) {
    return (
      <Button variant="ghost" className="w-full text-danger" onClick={() => setOpen(true)}>
        {t("deleteAccount")}
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-3xl border-2 border-danger bg-danger-soft p-5">
      <h2 className="font-black text-danger">{t("deleteAccount")}</h2>
      <p className="text-sm">{t("deleteWarning")}</p>
      <Label htmlFor="delete-confirm">{t("deleteConfirm", { word })}</Label>
      <Input id="delete-confirm" value={confirmation} autoCapitalize="characters" autoComplete="off" onChange={(e) => setConfirmation(e.target.value)} />
      <ErrorMessage code={error} />
      <div className="flex gap-2">
        <Button
          variant="danger"
          className="flex-1"
          disabled={pending || confirmation.trim().toUpperCase() !== word}
          onClick={() =>
            startTransition(async () => {
              await clearOfflineData();
              const res = await deleteAccountAction(confirmation);
              if (res && !res.ok) setError(res.error);
            })
          }
        >
          {t("deleteForever")}
        </Button>
        <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
