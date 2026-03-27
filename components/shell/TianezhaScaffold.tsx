import type { ReactNode } from "react";

import { LoadedIdentityRail } from "@/components/identity/LoadedIdentityRail";
import { SiteNav } from "@/components/SiteNav";

export function TianezhaScaffold({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <SiteNav />
      <div className="tianezha-layout">
        <main className="tianezha-main">{children}</main>
        <aside className="tianezha-rail">
          <LoadedIdentityRail />
        </aside>
      </div>
    </div>
  );
}
