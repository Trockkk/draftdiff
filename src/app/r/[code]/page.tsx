import { notFound } from "next/navigation";
import { Suspense } from "react";
import { normalizeCode } from "@/lib/room";
import OnlineGame from "./OnlineGame";

async function Room({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  if (!code) notFound();
  return <OnlineGame code={code} />;
}

export default function RoomPage({ params }: PageProps<"/r/[code]">) {
  return (
    <Suspense>
      <Room params={params} />
    </Suspense>
  );
}
