import type { Role } from "@/lib/draft/config";

// LoL client position icons (public/roles, from CommunityDragon), used as a mask so they take currentColor.
export default function RoleIcon({ role, className = "size-5" }: { role: Role; className?: string }) {
  const mask = `url(/roles/${role}.png) center / contain no-repeat`;
  return <span aria-hidden className={`inline-block shrink-0 bg-current ${className}`} style={{ mask, WebkitMask: mask }} />;
}
