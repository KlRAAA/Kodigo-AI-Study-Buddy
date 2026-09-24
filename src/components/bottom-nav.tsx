"use client";

import { BookOpen, Home, Plus, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/home", key: "home", Icon: Home },
  { href: "/search", key: "search", Icon: Search },
  { href: "/create", key: "create", Icon: Plus },
  { href: "/review", key: "review", Icon: BookOpen },
  { href: "/profile", key: "profile", Icon: UserRound },
] as const;

export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("label")}
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-xl">
        {tabs.map(({ href, key, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const isCreate = key === "create";
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-bold",
                  active ? "text-primary" : "text-muted hover:text-text",
                )}
              >
                {isCreate ? (
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-md">
                    <Icon aria-hidden className="size-6" strokeWidth={2.75} />
                  </span>
                ) : (
                  <Icon aria-hidden className="size-6" strokeWidth={active ? 2.5 : 2} />
                )}
                <span>{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
