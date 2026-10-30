import type { Role } from "../draft/config";

// Counts are recency/league weighted sums, so they can be fractional.
export type Rec = { g: number; w: number }; // games, wins

export type ChampionInfo = {
  id: string; // Data Dragon id, e.g. "KSante"
  name: string; // display name, e.g. "K'Sante"
  tags: string[]; // Data Dragon classes: Tank, Fighter, Mage, Assassin, Marksman, Support
  attack: number; // Data Dragon info 0-10
  magic: number;
  roles: Partial<Record<Role, Rec>>;
  bans: number;
  picks: number;
};

export type ProData = {
  meta: {
    generatedAt: string;
    ddragonVersion: string;
    games: number;
    patches: string[];
    leagues: string[];
    weights: Weights;
    eval: { holdoutGames: number; accuracy: number; logLoss: number; baselineLogLoss: number } | null;
  };
  champions: Record<string, ChampionInfo>;
  matchups: Record<string, Rec>; // `${role}|${A}|${B}` with A < B, wins from A's view
  synergies: Record<string, Rec>; // `${A}|${B}` with A < B
  blueSide: Rec;
};

export type Weights = {
  bias: number; // blue side advantage
  champ: number;
  matchup: number;
  synergy: number;
  comp: number;
};

export type TeamPicks = string[]; // champion ids indexed by role (TOP..SUPPORT)
