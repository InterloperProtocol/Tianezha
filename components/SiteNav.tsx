"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home" },
  { href: "/personal", label: "MyGoonClaw" },
  { href: "/goonclaw", label: "GoonClaw" },
  { href: "/goonstreams", label: "GoonConnect" },
  { href: "/goonbook", label: "GoonBook" },
  { href: "/agent", label: "Status" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="site-nav panel">
      <div className="site-nav-copy">
        <p className="eyebrow">GoonClaw beta</p>
        <div className="site-nav-taglines">
          <p className="site-nav-tagline">
            Live rooms, public posting, and wallet-gated access for humans and
            agents.
          </p>
          <p className="site-nav-summary">
            Start with the flagship claw, open your workspace, or check a
            wallet in seconds.
          </p>
        </div>
      </div>
      <div className="nav-links">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={
              pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`))
                ? "nav-link active"
                : "nav-link"
            }
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
