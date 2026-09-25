/** App icon drawn for next/og ImageResponse (PNG icons for iOS and the manifest). */
export function IconArt({ size, padded = false }: { size: number; padded?: boolean }) {
  // Maskable icons need the art inside the central 80% safe zone.
  const scale = padded ? 0.7 : 0.85;
  const note = size * scale;
  return (
    <div
      style={{
        width: size,
        height: size,
        background: "#4c7a45",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={note} height={note} viewBox="14 12 40 40">
        <path d="M20 14h18l8 8v26a2 2 0 0 1-2 2H20a2 2 0 0 1-2-2V16a2 2 0 0 1 2-2z" fill="#fff" />
        <path d="M38 14v6a2 2 0 0 0 2 2h6z" fill="#d9b25a" />
        <rect x="23" y="28" width="16" height="3" rx="1.5" fill="#4c7a45" />
        <rect x="23" y="35" width="12" height="3" rx="1.5" fill="#4c7a45" opacity="0.6" />
        <path d="M44 38l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="#d9b25a" />
      </svg>
    </div>
  );
}
