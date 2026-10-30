import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import Logo from "@/components/Logo";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Draftdiff — simulateur de draft pro LoL",
  description: "Draft tournoi League of Legends contre un ami, avec prédiction du gagnant basée sur les stats pro.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-edge">
          <nav className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6 text-sm">
            <Logo />
            <div className="flex gap-4 text-muted ml-auto">
              <Link href="/" className="hover:text-fg transition-colors">Jouer</Link>
              <Link href="/about" className="hover:text-fg transition-colors">À propos</Link>
            </div>
          </nav>
        </header>
        <main className="flex-1 flex flex-col">{children}</main>
        <footer className="border-t border-edge px-4 py-4 text-[11px] leading-relaxed text-faint">
          <p className="max-w-6xl mx-auto">
            Draftdiff isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of Riot Games or anyone
            officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are
            trademarks or registered trademarks of Riot Games, Inc.
          </p>
        </footer>
      </body>
    </html>
  );
}
