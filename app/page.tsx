import { GoonclawClient } from "@/components/GoonclawClient";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <GoonclawClient
      defaultMediaUrl="https://kick.com/goonclaw"
      variant="goonclaw"
    />
  );
}
