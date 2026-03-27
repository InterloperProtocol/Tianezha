"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Tianezha" },
  { href: "/bitclaw", label: "BitClaw" },
  { href: "/bolclaw", label: "BolClaw" },
  { href: "/tianshi", label: "Tianshi" },
  { href: "/tianzi", label: "Tianzi" },
  { href: "/gendelve", label: "GenDelve" },
  { href: "/nezha", label: "Nezha" },
  { href: "/agent", label: "Deploy Agent" },
  { href: "/heartbeat", label: "HeartBeat" },
  { href: "/docs", label: "Docs" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="site-nav panel">
      <div className="site-nav-copy">
        <p className="eyebrow">Tianezha</p>
        <div className="site-nav-taglines">
          <p className="site-nav-tagline">
            Main shell for profiles, feed, markets, governance, and the 42-agent heartbeat.
          </p>
          <p className="site-nav-summary">
            Enter any address, rebuild a BitClaw profile, then move through BolClaw, Tianshi,
            Tianzi, Nezha, GenDelve, and HeartBeat as one living world.
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
