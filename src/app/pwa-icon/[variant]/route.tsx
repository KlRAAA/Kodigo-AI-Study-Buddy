import { ImageResponse } from "next/og";
import { IconArt } from "@/components/icon-art";

const variants = {
  "192.png": { size: 192, padded: false },
  "512.png": { size: 512, padded: false },
  "maskable-512.png": { size: 512, padded: true },
} as const;

export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(variants).map((variant) => ({ variant }));
}

export async function GET(_req: Request, { params }: RouteContext<"/pwa-icon/[variant]">) {
  const v = variants[(await params).variant as keyof typeof variants];
  if (!v) return new Response("Not found", { status: 404 });
  return new ImageResponse(<IconArt size={v.size} padded={v.padded} />, { width: v.size, height: v.size });
}
