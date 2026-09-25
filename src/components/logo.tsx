import { cn } from "@/lib/utils";

/** Kodigo mark: a folded "cheat sheet" note with a spark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("size-10", className)}>
      <rect x="4" y="4" width="56" height="56" rx="16" fill="var(--primary)" />
      <path d="M20 16h18l8 8v24a2 2 0 0 1-2 2H20a2 2 0 0 1-2-2V18a2 2 0 0 1 2-2z" fill="#fff" />
      <path d="M38 16v6a2 2 0 0 0 2 2h6z" fill="var(--accent)" />
      <rect x="23" y="29" width="16" height="3" rx="1.5" fill="var(--primary)" />
      <rect x="23" y="36" width="12" height="3" rx="1.5" fill="var(--primary)" opacity=".6" />
      <path d="M44 38l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="var(--accent)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="size-9" />
      <span className="text-2xl font-black tracking-tight text-text">Kodigo</span>
    </span>
  );
}
