"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { StatusBadge } from "@/components/ui/StatusBadge";

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
  const activeItem =
    items.find(
      (item) =>
        pathname === item.href ||
        (item.href !== "/" && pathname.startsWith(`${item.href}/`)),
    ) ?? items[0];

  return (
    <nav className="site-nav panel">
      <div className="site-nav-copy">
        <p className="eyebrow">GoonClaw</p>
        <strong>Entity wall plus user workspace</strong>
        <p className="site-nav-summary">
          GoonClaw is the autonomous entity and owner-facing public wall. MyGoonClaw
          is the user workspace where streamers manage devices, sessions, media,
          and public pages. The rest of the app stays focused on discovery,
          access, and platform visibility.
        </p>
        <div className="route-badges">
          <StatusBadge tone="accent">You&apos;re here: {activeItem.label}</StatusBadge>
          <StatusBadge tone="neutral">Live tools, easy to scan</StatusBadge>
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
