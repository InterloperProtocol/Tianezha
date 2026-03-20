"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home" },
  { href: "/eligibility", label: "Eligibility" },
  { href: "/goonclaw", label: "Personal" },
  { href: "/livestream", label: "Livestream" },
  { href: "/agent", label: "Agent" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="site-nav panel">
      <div>
        <p className="eyebrow">GoonClaw</p>
        <strong>Private and public control surfaces</strong>
      </div>
      <div className="nav-links">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={pathname === item.href ? "nav-link active" : "nav-link"}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
