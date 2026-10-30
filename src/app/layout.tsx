import type { Metadata } from "next";
import { Cinzel, Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"], weight: ["600", "700"] });

export const metadata: Metadata = {
  title: "Draftdiff — simulateur de draft pro LoL",
  description: "Draft tournoi League of Legends contre un ami, avec prédiction du gagnant basée sur les stats pro.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${inter.variable} ${cinzel.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <main className="flex-1 flex flex-col">{children}</main>
        <footer className="px-4 py-3 text-[11px] leading-snug text-mute border-t border-line">
          <div className="max-w-6xl mx-auto flex flex-col gap-1">
            <div className="flex gap-4">
              <Link href="/" className="hover:text-gold">Accueil</Link>
              <Link href="/about" className="hover:text-gold">À propos</Link>
            </div>
            <p>
              Draftdiff isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of Riot Games or
              anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated
              properties are trademarks or registered trademarks of Riot Games, Inc.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
