import { Suspense } from "react";
import LocalGame from "./LocalGame";

export default function PlayPage() {
  return (
    <Suspense>
      <LocalGame />
    </Suspense>
  );
}
