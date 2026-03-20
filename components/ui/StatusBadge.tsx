import clsx from "clsx";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

export function StatusBadge({
  children,
  tone = "neutral",
  mono = false,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  mono?: boolean;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "status-badge",
        `status-badge-${tone}`,
        mono && "status-badge-mono",
        className,
      )}
    >
      {children}
    </span>
  );
}
