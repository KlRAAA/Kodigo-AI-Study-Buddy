"use client";

import { BookOpen, Compass, Home, Plus, Search, Shield, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const groups = [
  [
    { href: "/home", key: "home", Icon: Home },
    { href: "/search", key: "search", Icon: Search },
    { href: "/review", key: "review", Icon: BookOpen },
  ],
  [
    { href: "/explore", key: "explore", Icon: Compass },
    { href: "/trash", key: "trash", Icon: Trash2 },
  ],
] as const;

/** Desktop navigation (lg and up). Phones use the bottom bar. */
export function SideNav({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const item = (href: string, label: string, Icon: typeof Home) => (
    <Link
      key={href}
      href={href}
      aria-current={isActive(href) ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-xl px-3 font-bold transition-colors",
        isActive(href) ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2 hover:text-text",
      )}
    >
      <Icon aria-hidden className="size-5" />
      {label}
    </Link>
  );

  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col gap-6 border-r border-border bg-surface px-4 py-5 lg:flex"
    >
      <Link href="/home" aria-label="Kodigo" className="px-2">
        <Logo />
      </Link>

      <Link
        href="/create"
        className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary font-bold text-on-primary transition-transform hover:-translate-y-px hover:shadow-md active:scale-[0.98]"
      >
        <Plus aria-hidden className="size-5" strokeWidth={2.75} /> {t("create")}
      </Link>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto">
        {groups.map((group, i) => (
          <div key={i} className="space-y-1">
            {group.map(({ href, key, Icon }) => item(href, t(key), Icon))}
          </div>
        ))}
      </div>

      <div className="space-y-1 border-t border-border pt-4">
        {isAdmin && item("/admin", "Admin", Shield)}
        {item("/profile", t("profile"), UserRound)}
      </div>
    </nav>
  );
}
