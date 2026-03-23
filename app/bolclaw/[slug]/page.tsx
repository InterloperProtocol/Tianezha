import { notFound } from "next/navigation";

import { PublicStreamClient } from "@/components/PublicStreamClient";
import {
  buildPublicStreamPath,
  getPublicStreamPageState,
} from "@/lib/server/public-streams";

export const dynamic = "force-dynamic";

export default async function PublicBolClawPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const state = await getPublicStreamPageState(slug);

  if (!state) {
    notFound();
  }

  return (
    <PublicStreamClient
      slug={slug}
      initialState={{
        ...state,
        publicUrl: buildPublicStreamPath(state.profile.slug),
      }}
    />
  );
}
