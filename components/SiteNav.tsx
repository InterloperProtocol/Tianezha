"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { StatusBadge } from "@/components/ui/StatusBadge";

const items = [
  { href: "/", label: "Home" },
  { href: "/eligibility", label: "Access" },
  { href: "/goonclaw", label: "GoonClaw" },
  { href: "/personal", label: "MyGoonClaw" },
  { href: "/goonstreams", label: "GoonStreams" },
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
        <strong>One place to track the action</strong>
        <p className="site-nav-summary">
          Control the token in GoonClaw, run your streamer page in MyGoonClaw,
          browse live guest panels, and keep an eye on platform health from one
          clean dashboard.
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
