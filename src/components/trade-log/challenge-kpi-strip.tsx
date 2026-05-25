"use client";

import { useMemo } from "react";
import { 
  getChallengeCoreKpis, 
  getCoreKpiHelperText
} from "@/models/trade-log/kpi-metrics";
import { formatMoney } from "@/models/trade-log/format";
import type { Challenge, LogTrade, HedgePair } from "@/models/trade-log/types";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  helperText?: string;
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
}

function KpiCard({ label, value, helperText, variant = "default", className }: KpiCardProps) {
  return (
    <div className={cn(
      "rounded-lg border bg-card px-3 py-2.5 shadow-sm",
      "border-border/40",
      variant === "success" && "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20",
      variant === "warning" && "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20", 
      variant === "danger" && "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20",
      className
    )}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn(
        "mt-0.5 text-lg font-semibold tabular-nums leading-tight text-foreground",
        variant === "success" && "text-green-700 dark:text-green-300",
        variant === "warning" && "text-amber-700 dark:text-amber-300",
        variant === "danger" && "text-red-700 dark:text-red-300"
      )}>
        {value}
      </p>
      {helperText && (
        <p className="mt-1 text-[9px] font-medium text-muted-foreground/80 leading-tight">
          {helperText}
        </p>
      )}
    </div>
  );
}

interface ChallengeKpiStripProps {
  challenge: Challenge;
  trades: LogTrade[];
  pairs: HedgePair[];
  className?: string;
}

export function ChallengeKpiStrip({ 
  challenge, 
  trades, 
  pairs, 
  className 
}: ChallengeKpiStripProps) {
  const kpis = useMemo(
    () => getChallengeCoreKpis(challenge, trades, pairs),
    [challenge, trades, pairs]
  );

  // Helper function to format currency consistently
  const formatCurrency = (value: number) => {
    if (Math.abs(value) < 0.01) return "$0";
    return formatMoney(value);
  };

  const helperOpts = { isHedgeCycleComplete: kpis.isHedgeCycleComplete };
  const settled = kpis.isHedgeCycleComplete;

  return (
    <div className={cn(
      "grid gap-3 sm:grid-cols-2",
      settled ? "lg:grid-cols-2" : "lg:grid-cols-4",
      className
    )}>
      <KpiCard
        label="Total Invested"
        value={formatCurrency(kpis.totalInvested)}
        helperText={getCoreKpiHelperText("totalInvested", helperOpts)}
      />

      {!settled ? (
        <>
          <KpiCard
            label="Left to Hedge"
            value={formatCurrency(kpis.leftToHedge)}
            helperText={getCoreKpiHelperText("leftToHedge", helperOpts)}
            variant={kpis.warnings.budgetExceeded ? "danger" : "default"}
          />

          <KpiCard
            label="If We Pass Today"
            value={formatCurrency(kpis.ifWePassToday)}
            helperText={getCoreKpiHelperText("ifWePassToday", helperOpts)}
            variant={kpis.ifWePassToday > 0 ? "success" : "danger"}
          />
        </>
      ) : null}

      <KpiCard
        label="Phases Done"
        value={String(kpis.phasesDone)}
        helperText={getCoreKpiHelperText("phasesDone", helperOpts)}
      />
    </div>
  );
}
