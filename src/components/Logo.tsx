import Link from "next/link";

export default function Logo() {
  return (
    <Link href="/" className="text-base font-semibold tracking-tight text-fg">
      draftdiff<span className="text-accent">.</span>
    </Link>
  );
}
