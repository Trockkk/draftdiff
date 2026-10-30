"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import ResultView, { type AnalyzeResult } from "@/components/ResultView";
import { analyze } from "@/lib/analyze";

// Shared result link: the draft is in the URL, the analysis is recomputed.
function SharedResult() {
  const q = useSearchParams();
  const blue = (q.get("b") ?? "").split(",");
  const red = (q.get("r") ?? "").split(",");
  const names = { blue: q.get("nb") || "Blue", red: q.get("nr") || "Red" };
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = q.toString();

  useEffect(() => {
    analyze(blue, red, names).then(setResult, (e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (error) return <p className="text-red-side text-center p-8">{error}</p>;
  return <ResultView blue={blue} red={red} names={names} result={result} actions={<Link href="/" className="btn-gold px-6 py-2">Faire ma draft</Link>} />;
}

export default function ResultPage() {
  return (
    <Suspense>
      <SharedResult />
    </Suspense>
  );
}
