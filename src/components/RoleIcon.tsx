import type { Role } from "@/lib/draft/config";

// Simple hand-drawn lane glyphs (no Riot assets).
export default function RoleIcon({ role, className = "size-5" }: { role: Role; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const };
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {role === "TOP" && (
        <>
          <path d="M4 20V4h16" {...common} />
          <rect x="9" y="9" width="11" height="11" rx="1" fill="currentColor" opacity="0.35" />
        </>
      )}
      {role === "JUNGLE" && <path d="M12 3c-3 4-5 8-4 13l4 5 4-5c1-5-1-9-4-13zM12 8v10" {...common} />}
      {role === "MID" && (
        <>
          <path d="M4 20 20 4" {...common} />
          <path d="M4 4h6M4 4v6M20 20h-6M20 20v-6" {...common} opacity="0.5" />
        </>
      )}
      {role === "BOT" && (
        <>
          <path d="M20 4v16H4" {...common} />
          <rect x="4" y="4" width="11" height="11" rx="1" fill="currentColor" opacity="0.35" />
        </>
      )}
      {role === "SUPPORT" && <path d="M12 3 4 7v5c0 4 3.5 7.5 8 9 4.5-1.5 8-5 8-9V7l-8-4zM12 8v8M8 12h8" {...common} />}
    </svg>
  );
}
