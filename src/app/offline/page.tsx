import type { Metadata } from "next";
import { OfflineLibrary } from "./offline-library";

export const metadata: Metadata = { title: "Offline" };

// Served by the service worker when there's no connection.
export default function OfflinePage() {
  return (
    <main className="pt-safe pb-safe mx-auto min-h-dvh max-w-xl px-4">
      <OfflineLibrary />
    </main>
  );
}
