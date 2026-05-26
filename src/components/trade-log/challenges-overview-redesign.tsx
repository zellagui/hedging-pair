"use client";

import { useMemo, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { formatMoney } from "@/models/trade-log/format";
import { calculateWorkspaceMetrics } from "@/models/trade-log/workspace-metrics";
import { useTradingStore } from "@/models/trade-log/store";
import { cn } from "@/lib/utils";

interface ChallengesOverviewProps {
  selectedWorkspaceId: string | null;
  className?: string;
}

function moneyTint(value: number): string {
  if (value > 0) return "text-emerald-600 dark:text-emerald-400";
  if (value < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

function KpiInline({
  label,
  value,
  hint,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  hint: string;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
      <p className={cn("text-base font-semibold tabular-nums leading-none tracking-tight", valueClassName)}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] leading-none text-muted-foreground/50">{hint}</p>
    </div>
  );
}

export function ChallengesOverview({ selectedWorkspaceId, className }: ChallengesOverviewProps) {
  const { trades, challenges, pairs, sessions, identities } = useTradingStore(
    useShallow((s) => ({
      trades: s.trades,
      challenges: s.challenges,
      pairs: s.pairs,
      sessions: s.sessions,
      identities: s.identities,
    }))
  );

  const kpis = useMemo(() => {
    const metrics = calculateWorkspaceMetrics(
      selectedWorkspaceId,
      trades,
      challenges,
      pairs,
      sessions,
      identities
    );
    const { challengeListKpis } = metrics;
    return {
      fundInEval: challengeListKpis.fundInEval,
      closedProfit: challengeListKpis.netRealExclEvaluation,
      activeCount: challengeListKpis.live,
      totalCount: challengeListKpis.count,
    };
  }, [selectedWorkspaceId, trades, challenges, pairs, sessions, identities]);

  const fundOutflow = kpis.fundInEval > 0 ? -kpis.fundInEval : 0;

  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-x-6 gap-y-3 sm:gap-x-8 lg:gap-x-10",
        className
      )}
    >
      <KpiInline
        label="Fund in eval"
        value={formatMoney(fundOutflow)}
        hint="Fees + personal account trades"
        valueClassName="text-red-600 dark:text-red-400"
      />
      <KpiInline
        label="Closed profit"
        value={formatMoney(kpis.closedProfit)}
        hint="Settled, excl. open eval"
        valueClassName={moneyTint(kpis.closedProfit)}
      />
      <KpiInline
        label="Active"
        value={kpis.activeCount}
        hint={`${kpis.totalCount} total`}
      />
    </div>
  );
}
