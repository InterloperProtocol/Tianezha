import clsx from "clsx";

import { StatusBadge } from "@/components/ui/StatusBadge";

type BadgeItem = React.ReactNode | string;

function isStringBadge(item: BadgeItem): item is string {
  return typeof item === "string";
}

export function RouteHeader({
  eyebrow,
  title,
  summary,
  badges = [],
  actions,
  rail,
  className,
}: {
  eyebrow: string;
  title: string;
  summary: React.ReactNode;
  badges?: BadgeItem[];
  actions?: React.ReactNode;
  rail?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("route-header", className)}>
      <div className="route-header-main">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="route-summary">{summary}</p>
        {badges.length ? (
          <div className="route-badges">
            {badges.map((badge, index) =>
              isStringBadge(badge) ? (
                <StatusBadge key={`${badge}-${index}`}>{badge}</StatusBadge>
              ) : (
                <div key={index}>{badge}</div>
              ),
            )}
          </div>
        ) : null}
        {actions ? <div className="route-actions">{actions}</div> : null}
      </div>
      {rail ? <aside className="route-header-rail">{rail}</aside> : null}
    </section>
  );
}
