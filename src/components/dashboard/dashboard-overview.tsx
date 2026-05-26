"use client";

import { useMemo } from "react";
import { localTodayYmd } from "@/models/trade-log/format";
import type {
  Challenge,
  HedgePair,
  Identity,
  LogSession,
  LogTrade,
} from "@/models/trade-log/types";
import {
  calculateOverviewMetrics,
  formatPercentage,
  type CanonicalWorkspaceMetrics,
} from "@/models/trade-log/workspace-metrics";
import { formatMoney } from "@/models/trade-log/format";
import {
  DashboardSection,
  DashboardStatCard,
  DashboardStatRow,
} from "./dashboard-card";
import { WorkspaceBreakdownTable } from "./workspace-breakdown-table";

interface DashboardOverviewProps {
  trades: LogTrade[];
  challenges: Challenge[];
  pairs: HedgePair[];
  sessions: LogSession[];
  identities: Identity[];
}

function moneyTint(value: number): string {
  if (value > 0) return "text-emerald-600 dark:text-emerald-400";
  if (value < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

// Same KPI strip as the Challenges page header — portfolio-wide
function GlobalSummaryStrip({ metrics }: { metrics: CanonicalWorkspaceMetrics }) {
  const { challengeListKpis } = metrics;
  const fundOutflow =
    challengeListKpis.fundInEval > 0 ? -challengeListKpis.fundInEval : 0;

  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-muted-foreground">Fund in eval</p>
        <p className="text-base font-semibold tabular-nums leading-none text-red-600 dark:text-red-400">
          {formatMoney(fundOutflow)}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground/50">Fees + personal on open evals</p>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-muted-foreground">Closed profit</p>
        <p className={`text-base font-semibold tabular-nums leading-none ${moneyTint(challengeListKpis.netRealExclEvaluation)}`}>
          {formatMoney(challengeListKpis.netRealExclEvaluation)}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground/50">Settled, excl. open eval</p>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-muted-foreground">Net result</p>
        <p className={`text-base font-semibold tabular-nums leading-none ${moneyTint(metrics.bookAfterFees)}`}>
          {formatMoney(metrics.bookAfterFees)}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground/50">Closed profit + open eval net</p>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-muted-foreground">Active</p>
        <p className="text-base font-semibold tabular-nums leading-none text-foreground">
          {challengeListKpis.live}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground/50">{challengeListKpis.count} total</p>
      </div>
    </div>
  );
}

export function DashboardOverview({
  trades,
  challenges,
  pairs,
  sessions,
  identities,
}: DashboardOverviewProps) {
  // Always use global metrics (all workspaces) for Overview page
  const canonicalMetrics = useMemo(
    () => calculateOverviewMetrics(
      trades,
      challenges,
      pairs,
      sessions,
      identities
    ),
    [trades, challenges, pairs, sessions, identities]
  );

  return (
    <div className="space-y-8">
      {/* Minimal Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Portfolio overview across all workspaces
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Last updated: {localTodayYmd()}
        </p>
      </div>

      {/* Workspace Breakdown (Full Width) */}
      <DashboardSection title="Workspace Breakdown">
        <WorkspaceBreakdownTable workspaces={canonicalMetrics.workspaceBreakdown} />
      </DashboardSection>

      {/* Global Summary Strip */}
      <GlobalSummaryStrip metrics={canonicalMetrics} />

      {/* Statistics Detail Grid */}
      <DashboardSection title="Statistics">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Challenge Metrics</h4>
            <div className="space-y-2">
              <DashboardStatCard
                label="Average challenge fee"
                value={canonicalMetrics.statistics.averageChallengeFee}
                format="money"
              />
              <DashboardStatCard
                label="Total challenge fees"
                value={canonicalMetrics.statistics.totalChallengeFees}
                format="money"
              />
              <DashboardStatCard
                label="Avg trades per active challenge"
                value={canonicalMetrics.statistics.averageTradesPerActiveChallenge}
                format="integer"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Performance</h4>
            <div className="space-y-2">
              <DashboardStatCard
                label="Average personal leg P&L"
                value={canonicalMetrics.statistics.averagePersonalPnl}
                format="money"
              />
              <DashboardStatCard
                label="Average firm leg P&L"
                value={canonicalMetrics.statistics.averageFirmPnl}
                format="money"
              />
              <DashboardStatCard
                label="Average trade overall"
                value={canonicalMetrics.statistics.averageTradeOverall}
                format="money"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Trade Analysis</h4>
            <div className="space-y-2">
              <DashboardStatCard
                label="Win rate"
                value={formatPercentage(canonicalMetrics.statistics.winRate)}
                format="string"
              />
              <DashboardStatCard
                label="Positive trades"
                value={canonicalMetrics.statistics.positiveTradeCount}
                format="integer"
              />
              <DashboardStatCard
                label="Negative trades"
                value={canonicalMetrics.statistics.negativeTradeCount}
                format="integer"
              />
              <DashboardStatCard
                label="Flat trades"
                value={canonicalMetrics.statistics.flatTradeCount}
                format="integer"
              />
            </div>
          </div>
        </div>

        {/* Footer stats row */}
        <DashboardStatRow
          stats={[
            { label: "Avg trades per workspace", value: canonicalMetrics.statistics.averageTradesPerWorkspace, format: "integer" },
            { label: "Most traded symbol", value: canonicalMetrics.statistics.mostTradedSymbol || "—", format: "string" },
            { label: "Latest trade", value: canonicalMetrics.statistics.latestTradeTimestamp ? new Date(canonicalMetrics.statistics.latestTradeTimestamp).toLocaleDateString() : "—", format: "string" },
          ]}
          className="border-t border-border pt-4"
        />
      </DashboardSection>
    </div>
  );
}