import { InternalAdminDashboard } from "@/components/InternalAdminDashboard";
import { getServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function HiddenAdminPage() {
  return (
    <InternalAdminDashboard
      defaultUsername={getServerEnv().INTERNAL_ADMIN_LOGIN}
    />
  );
}
