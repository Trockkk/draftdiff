import type { Side } from "@/lib/draft/config";
import { score, type Series } from "@/lib/draft/series";

// `done`: the current game is already recorded (result screen).
export default function SeriesBar({ series, names, extra, done }: { series: Series; names: Record<Side, string>; extra?: React.ReactNode; done?: boolean }) {
  const sc = score(series);
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-text">
      <span>
        Bo{series.format}
        {series.fearless && " · Fearless"} · Game {series.games.length + (done ? 0 : 1)}
      </span>
      {series.format > 1 && (
        <span className="font-display text-sm">
          <span className="text-blue-side">{names.blue} {sc.blue}</span> — <span className="text-red-side">{sc.red} {names.red}</span>
        </span>
      )}
      {extra}
    </div>
  );
}
