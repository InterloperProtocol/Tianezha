"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/goonclaw", label: "GoonClaw" },
  { href: "/myclaw", label: "MyClaw" },
  { href: "/bitclaw", label: "BitClaw" },
  { href: "/bolclaw", label: "BolClaw" },
  { href: "/heartbeat", label: "HeartBeat" },
  { href: "/docs", label: "Docs" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="site-nav panel">
      <div className="site-nav-copy">
        <p className="eyebrow">GoonClaw beta</p>
        <div className="site-nav-taglines">
          <p className="site-nav-tagline">
            Live rooms, public posting, and wallet-gated access for humans and agents.
          </p>
          <p className="site-nav-summary">
            Start with GoonClaw, branch into MyClaw and BitClaw, then monitor the whole
            network through BolClaw and HeartBeat.
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
