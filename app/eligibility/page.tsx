import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    wallet?: string;
  }>;
};

export default async function EligibilityPage({ searchParams }: Props) {
  const { wallet } = await searchParams;
  const query = wallet?.trim()
    ? `?wallet=${encodeURIComponent(wallet.trim())}`
    : "";

  redirect(`/${query}#wallet-access`);
}
