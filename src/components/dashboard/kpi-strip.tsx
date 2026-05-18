import type { KpiMetric } from "@/lib/dashboard-mock";
import { formatPercent, formatUsd } from "@/lib/format-dashboard";
import { cn } from "@/lib/utils";

function formatKpiValue(metric: KpiMetric) {
  if (metric.kind === "percent") {
    return formatPercent(metric.value);
  }
  return formatUsd(metric.value);
}

function valueClass(metric: KpiMetric) {
  if (metric.kind === "percent") return "text-foreground";
  if (metric.value > 0) {
    return "text-emerald-600 dark:text-emerald-400";
  }
  if (metric.value < 0) {
    return "text-red-600 dark:text-red-400";
  }
  return "text-foreground";
}

export function KpiStrip({ metrics }: { metrics: KpiMetric[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map((m) => (
          <div
            key={m.id}
            className="rounded-lg border border-border/60 bg-background/50 px-3 py-3"
          >
            <p className="text-xs font-medium text-muted-foreground">{m.label}</p>
            <p
              className={cn(
                "mt-1 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl",
                valueClass(m)
              )}
            >
              {formatKpiValue(m)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
