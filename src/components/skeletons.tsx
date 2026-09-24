import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

/** A pulsing placeholder block. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-2xl", className)} />;
}

/** Wraps a skeleton page so screen readers hear "Loading…" once. */
async function SkeletonPage({ children, className }: { children: React.ReactNode; className?: string }) {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-busy="true" className={cn("space-y-5 py-4", className)}>
      <span className="sr-only">{t("loading")}</span>
      {children}
    </div>
  );
}

function SkeletonRows({ count, className }: { count: number; className?: string }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={cn("h-[4.5rem]", className)} />
      ))}
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <SkeletonPage>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-7 w-44" />
        </div>
        <Skeleton className="h-8 w-32 rounded-full" />
      </div>
      <Skeleton className="h-24 rounded-3xl" />
      <Skeleton className="h-12" />
      <Skeleton className="h-6 w-28" />
      <SkeletonRows count={4} />
    </SkeletonPage>
  );
}

export function ListPageSkeleton({ withSearch = false, rows = 5 }: { withSearch?: boolean; rows?: number }) {
  return (
    <SkeletonPage>
      <Skeleton className="h-8 w-40" />
      {withSearch && <Skeleton className="h-12" />}
      <SkeletonRows count={rows} />
    </SkeletonPage>
  );
}

export function ReviewSkeleton() {
  return (
    <SkeletonPage>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-24 rounded-3xl" />
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </SkeletonPage>
  );
}

export function CreateSkeleton() {
  return (
    <SkeletonPage>
      <div className="flex justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-32 rounded-full" />
      </div>
      <Skeleton className="h-12" />
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-18" />
        ))}
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-14" />
    </SkeletonPage>
  );
}

export function SetSkeleton() {
  return (
    <SkeletonPage>
      <Skeleton className="h-6 w-20" />
      <Skeleton className="h-8 w-3/4" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-3xl" />
        <Skeleton className="h-20 rounded-3xl" />
      </div>
      <Skeleton className="h-40 rounded-3xl" />
      <Skeleton className="h-6 w-28" />
      <SkeletonRows count={3} className="h-24" />
    </SkeletonPage>
  );
}

export function StudySkeleton() {
  return (
    <SkeletonPage>
      <div className="flex items-center gap-2">
        <Skeleton className="size-11" />
        <Skeleton className="h-10 w-48" />
      </div>
      <Skeleton className="h-3 rounded-full" />
      <Skeleton className="h-[22rem] rounded-3xl" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    </SkeletonPage>
  );
}

export function ProfileSkeleton() {
  return (
    <SkeletonPage>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-36 rounded-3xl" />
      <Skeleton className="h-28 rounded-3xl" />
      <Skeleton className="h-28 rounded-3xl" />
      <Skeleton className="h-28 rounded-3xl" />
    </SkeletonPage>
  );
}

/** Public pages (shared set, profile): header + content, no bottom nav. */
export function PublicSkeleton() {
  return (
    <div className="mx-auto max-w-xl px-4">
      <SkeletonPage>
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-14" />
        <Skeleton className="h-[22rem] rounded-3xl" />
      </SkeletonPage>
    </div>
  );
}
