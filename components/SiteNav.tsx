"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { StatusBadge } from "@/components/ui/StatusBadge";

const items = [
  { href: "/", label: "Home" },
  { href: "/eligibility", label: "Eligibility" },
  { href: "/goonclaw", label: "Personal" },
  { href: "/livestream", label: "Livestream" },
  { href: "/agent", label: "Agent" },
];

export function SiteNav() {
  const pathname = usePathname();
  const activeItem = items.find((item) => item.href === pathname) ?? items[0];

  return (
    <nav className="site-nav panel">
      <div className="site-nav-copy">
        <p className="eyebrow">GoonClaw</p>
        <strong>Retro shell, modern ergonomics</strong>
        <p className="site-nav-summary">
          Private operator control, public queue trust, wallet eligibility, and
          agent diagnostics all use the same console language.
        </p>
        <div className="route-badges">
          <StatusBadge tone="accent">Active surface: {activeItem.label}</StatusBadge>
          <StatusBadge tone="neutral">Status-first UI</StatusBadge>
        </div>
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
