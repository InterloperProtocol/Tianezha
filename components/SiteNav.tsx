"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/bitclaw", label: "BitClaw" },
  { href: "/bolclaw", label: "BolClaw" },
  { href: "/gistbook", label: "Gistbook" },
  { href: "/tianzi", label: "Tianzi" },
  { href: "/nezha", label: "Nezha" },
  { href: "/tianshi", label: "Tianshi" },
  { href: "/gendelve", label: "GenDelve" },
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
            Simulation-first shell for BitClaw, BolClaw, Tianzi, Nezha, Tianshi, and GenDelve.
          </p>
          <p className="site-nav-summary">
            Enter any address, rebuild a BitClaw profile, then move through the six public modules
            in one living world. Tianshi now carries the heartbeat publisher.
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
