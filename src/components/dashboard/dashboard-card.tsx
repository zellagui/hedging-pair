import { cn } from "@/lib/utils";
import { formatMoney } from "@/models/trade-log/format";

interface DashboardKpiCardProps {
  title: string;
  value: number | string;
  format?: "money" | "integer" | "percentage" | "string";
  variant?: "default" | "positive" | "negative" | "neutral";
  subtitle?: string;
  className?: string;
}

export function DashboardKpiCard({
  title,
  value,
  format = "money",
  variant = "default",
  subtitle,
  className,
}: DashboardKpiCardProps) {
  const formattedValue = formatValue(value, format);
  const valueColorClass = getValueColorClass(variant, format, value);

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card px-4 py-3 shadow-sm",
        className
      )}
    >
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <p
          className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums",
            valueColorClass
          )}
        >
          {formattedValue}
        </p>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

interface DashboardStatCardProps {
  label: string;
  value: number | string;
  format?: "money" | "integer" | "percentage" | "string";
  className?: string;
}

export function DashboardStatCard({
  label,
  value,
  format = "string",
  className,
}: DashboardStatCardProps) {
  const formattedValue = formatValue(value, format);

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md border border-border/50 bg-muted/20 px-3 py-2",
        className
      )}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums text-foreground">
        {formattedValue}
      </span>
    </div>
  );
}

interface DashboardSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function DashboardSection({ title, children, className }: DashboardSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      {children}
    </section>
  );
}

// Helper functions

function formatValue(
  value: number | string, 
  format: "money" | "integer" | "percentage" | "string"
): string {
  if (typeof value === "string") {
    return value;
  }

  switch (format) {
    case "money":
      return formatMoney(value);
    case "integer":
      return Math.round(value).toLocaleString();
    case "percentage":
      return `${(value * 100).toFixed(1)}%`;
    case "string":
      return String(value);
    default:
      return String(value);
  }
}

function getValueColorClass(
  variant: "default" | "positive" | "negative" | "neutral",
  format: string,
  value: number | string
): string {
  if (variant === "positive") {
    return "text-emerald-600 dark:text-emerald-400";
  }
  if (variant === "negative") {
    return "text-red-600 dark:text-red-400";
  }
  if (variant === "neutral") {
    return "text-foreground";
  }

  // Auto-detect for money format
  if (format === "money" && typeof value === "number") {
    if (value > 0) {
      return "text-emerald-600 dark:text-emerald-400";
    }
    if (value < 0) {
      return "text-red-600 dark:text-red-400";
    }
  }

  return "text-foreground";
}

// Helper component for displaying empty states
interface DashboardEmptyStateProps {
  message: string;
  description?: string;
  className?: string;
}

export function DashboardEmptyState({
  message,
  description,
  className,
}: DashboardEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/10 px-6 py-12 text-center",
        className
      )}
    >
      <p className="text-sm font-medium text-foreground">{message}</p>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

// Compact stat row for inline display
interface DashboardStatRowProps {
  stats: Array<{
    label: string;
    value: string | number;
    format?: "money" | "integer" | "percentage" | "string";
  }>;
  className?: string;
}

export function DashboardStatRow({ stats, className }: DashboardStatRowProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground",
        className
      )}
    >
      {stats.map((stat, index) => (
        <span key={index}>
          {stat.label}:&nbsp;
          <span className="font-medium tabular-nums text-foreground">
            {formatValue(stat.value, stat.format || "string")}
          </span>
        </span>
      ))}
    </div>
  );
}