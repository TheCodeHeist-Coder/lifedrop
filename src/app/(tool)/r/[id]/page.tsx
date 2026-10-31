import { Suspense } from "react";
import { RequestStatus } from "./request-status";

async function ResolvedStatus({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RequestStatus id={id} />;
}

export default function RequestPage({ params }: PageProps<"/r/[id]">) {
  return (
    <Suspense fallback={<p className="py-10 text-center text-muted">Loading your request...</p>}>
      <ResolvedStatus params={params} />
    </Suspense>
  );
}
