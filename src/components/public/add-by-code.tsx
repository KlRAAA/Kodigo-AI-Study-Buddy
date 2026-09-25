"use client";

import { KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { parseShareCode } from "@/lib/share-code";
import { Button, Input } from "@/components/ui";

/** Paste a set's code (or link) to open it, then "Copy to my library" adds it. */
export function AddByCode() {
  const t = useTranslations("shareCode");
  const router = useRouter();
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    const code = parseShareCode(value);
    if (!code) {
      setInvalid(true);
      return;
    }
    router.push(`/s/${code}`);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-1.5 rounded-2xl border border-border bg-surface p-3">
      <label htmlFor="share-code" className="flex items-center gap-2 text-sm font-bold">
        <KeyRound aria-hidden className="size-4 text-primary" /> {t("label")}
      </label>
      <div className="flex gap-2">
        <Input
          id="share-code"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setInvalid(false);
          }}
          placeholder={t("placeholder")}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={invalid}
          aria-describedby={invalid ? "share-code-error" : undefined}
        />
        <Button type="submit" className="shrink-0" disabled={!value.trim()}>
          {t("open")}
        </Button>
      </div>
      {invalid && (
        <p id="share-code-error" role="alert" className="text-sm font-semibold text-danger">
          {t("invalid")}
        </p>
      )}
    </form>
  );
}
