"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { validateFields, type FieldErrors, type Rule } from "@/lib/validate";
import type { ErrorCode } from "@/server/actions/result";
import { Alert, Button } from "./ui";

export function SubmitButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className={className ?? "w-full"}>
      {pending && <Loader2 aria-hidden className="size-5 animate-spin" />}
      {children}
    </Button>
  );
}

/** Shows a translated, friendly message for an action error code. */
export function ErrorMessage({ code }: { code: ErrorCode | null | undefined }) {
  const t = useTranslations("errors");
  if (!code) return null;
  return <Alert>{t(code)}</Alert>;
}

/**
 * In-app form validation (the form should have noValidate). Checks fields on
 * submit, focuses the first problem and shows a message under it.
 */
export function useFormChecks(rules: Record<string, Rule[]>) {
  const t = useTranslations("validation");
  const [errors, setErrors] = useState<FieldErrors>({});

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    const found = validateFields(new FormData(e.currentTarget), rules);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      e.preventDefault();
      e.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    }
  }

  /** Props for an input: marks it invalid and clears its error while typing. */
  function field(name: string, describedBy?: string) {
    const errorId = errors[name] ? `${name}-error` : undefined;
    return {
      "aria-invalid": errors[name] ? true : undefined,
      "aria-describedby": [describedBy, errorId].filter(Boolean).join(" ") || undefined,
      onInput: () => {
        if (errors[name]) {
          setErrors((prev) => {
            const next = { ...prev };
            delete next[name];
            return next;
          });
        }
      },
    };
  }

  function message(name: string) {
    const rule = errors[name];
    if (!rule) return null;
    return (
      <p id={`${name}-error`} className="mt-1 text-sm font-semibold text-danger">
        {t(rule)}
      </p>
    );
  }

  return { onSubmit, field, message };
}
