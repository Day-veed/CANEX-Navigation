import { Suspense } from "react";
import Wayfinder from "@/components/Wayfinder";

export default function Page({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<div className="grid h-dvh place-items-center text-sm text-[#5d6d67]">Loading map…</div>}>
      <WayfinderFromParams searchParams={searchParams} />
    </Suspense>
  );
}

async function WayfinderFromParams({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const { from, to } = await searchParams;
  return <Wayfinder initialFrom={typeof from === "string" ? from : undefined} initialTo={typeof to === "string" ? to : undefined} />;
}
