import type { Side } from "./draft/config";
import type { AnalyzeResult } from "@/components/ResultView";

export async function analyze(blue: string[], red: string[], names: Record<Side, string>): Promise<AnalyzeResult> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ blue, red, names }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Analyse impossible");
  return res.json();
}

// Final draft in the URL so a result can be shared without a database.
export const resultUrl = (blue: string[], red: string[], names: Record<Side, string>) =>
  `/result?${new URLSearchParams({ b: blue.join(","), r: red.join(","), nb: names.blue, nr: names.red })}`;
