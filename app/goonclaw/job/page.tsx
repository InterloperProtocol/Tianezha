import { redirect } from "next/navigation";

import { LivestreamJobClient } from "@/components/LivestreamJobClient";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    requestId?: string;
  }>;
};

export default async function GoonclawJobPage({ searchParams }: Props) {
  const { requestId } = await searchParams;
  const trimmedRequestId = requestId?.trim();

  if (!trimmedRequestId) {
    redirect("/goonclaw");
  }

  return <LivestreamJobClient requestId={trimmedRequestId} />;
}
