"use client";

import { useMemo } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  calculateDashboardStatistics,
  calculateGlobalDashboardKpis,
  calculateWorkspaceBreakdown,
  formatPercentage,
  getRecentTrades,
} from "@/models/trade-log/dashboard-metrics";
import { localTodayYmd } from "@/models/trade-log/format";
import type {
  Challenge,
  Identity,
  LogSession,
  LogTrade,
} from "@/models/trade-log/types";
import {
  DashboardKpiCard,
  DashboardSection,
  DashboardStatCard,
  DashboardStatRow,
} from "./dashboard-card";
import { RecentActivity } from "./recent-activity";
import { WorkspaceBreakdownTable } from "./workspace-breakdown-table";

interface DashboardOverviewProps {
  trades: LogTrade[];
  challenges: Challenge[];
  sessions: LogSession[];
  identities: Identity[];
  activeIdentityId: string | null;
  onWorkspaceChange: (identityId: string) => void;
}

export function DashboardOverview({
  trades,
  challenges,
  sessions,
  identities,
  activeIdentityId,
  onWorkspaceChange,
}: DashboardOverviewProps) {
  // Calculate all metrics
  const globalKpis = useMemo(
    () => calculateGlobalDashboardKpis(trades, challenges, sessions),
    [trades, challenges, sessions]
  );

  const statistics = useMemo(
    () => calculateDashboardStatistics(trades, challenges),
    [trades, challenges]
  );

  const workspaceBreakdown = useMemo(
    () => calculateWorkspaceBreakdown(identities, trades, challenges),
    [identities, trades, challenges]
  );

  const recentTrades = useMemo(() => getRecentTrades(trades, 8), [trades]);

  // Format workspace options
  const sortedIdentities = useMemo(
    () =>
      [...identities].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      ),
    [identities]
  );

  const effectiveWorkspaceId =
    activeIdentityId && identities.some((i) => i.id === activeIdentityId)
      ? activeIdentityId
      : identities[0]?.id ?? "";

  const activeWorkspaceName =
    sortedIdentities.find((i) => i.id === effectiveWorkspaceId)?.name ?? "All Workspaces";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time trading performance across all accounts and workspaces
          </p>
        </div>
        
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex items-center gap-3">
            <Label htmlFor="workspace-selector" className="text-sm font-medium">
              Scope
            </Label>
            <Select
              value={effectiveWorkspaceId || undefined}
              onValueChange={onWorkspaceChange}
            >
              <SelectTrigger id="workspace-selector" className="w-[200px]">
                <SelectValue placeholder="Select workspace" />
              </SelectTrigger>
              <SelectContent>
                {sortedIdentities.map((identity) => (
                  <SelectItem key={identity.id} value={identity.id}>
                    {identity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Last updated: {localTodayYmd()}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <DashboardSection title="Key Performance Indicators">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <DashboardKpiCard
            title="Book After Fees"
            value={globalKpis.bookAfterFees}
            format="money"
            subtitle="Net P&L minus challenge fees"
          />
          <DashboardKpiCard
            title="Personal Legs P&L"
            value={globalKpis.personalLegsTotal}
            format="money"
            subtitle="Hedge trades total"
          />
          <DashboardKpiCard
            title="Firm-side P&L"
            value={globalKpis.firmSideTotal}
            format="money"
            subtitle="Prop trades total"
          />
          <DashboardKpiCard
            title="Active Runways"
            value={globalKpis.activeRunways}
            format="integer"
            variant="neutral"
            subtitle="Evaluation phase challenges"
          />
          <DashboardKpiCard
            title="Failed Challenges"
            value={globalKpis.failedChallenges}
            format="integer"
            variant="neutral"
            subtitle="Terminated challenges"
          />
          <DashboardKpiCard
            title="Open Sessions Today"
            value={globalKpis.openSessionsToday}
            format="integer"
            variant="neutral"
            subtitle="Active trading sessions"
          />
        </div>
        
        {/* Helper breakdown */}
        <DashboardStatRow
          stats={[
            { label: "Gross before fees", value: globalKpis.grossBeforeFees, format: "money" },
            { label: "Total fees", value: globalKpis.totalFees, format: "money" },
            { label: "Net after fees", value: globalKpis.bookAfterFees, format: "money" },
          ]}
          className="border-t border-border pt-4"
        />
      </DashboardSection>

      {/* Statistics Section */}
      <DashboardSection title="Statistics">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Challenge Metrics</h4>
            <div className="space-y-2">
              <DashboardStatCard
                label="Average challenge fee"
                value={statistics.averageChallengeFee}
                format="money"
              />
              <DashboardStatCard
                label="Total challenge fees"
                value={statistics.totalChallengeFees}
                format="money"
              />
              <DashboardStatCard
                label="Avg trades per active challenge"
                value={statistics.averageTradesPerActiveChallenge}
                format="integer"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Performance</h4>
            <div className="space-y-2">
              <DashboardStatCard
                label="Average personal leg P&L"
                value={statistics.averagePersonalPnl}
                format="money"
              />
              <DashboardStatCard
                label="Average firm leg P&L"
                value={statistics.averageFirmPnl}
                format="money"
              />
              <DashboardStatCard
                label="Average trade overall"
                value={statistics.averageTradeOverall}
                format="money"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Trade Analysis</h4>
            <div className="space-y-2">
              <DashboardStatCard
                label="Win rate"
                value={formatPercentage(statistics.winRate)}
                format="string"
              />
              <DashboardStatCard
                label="Positive trades"
                value={statistics.positiveTradeCount}
                format="integer"
              />
              <DashboardStatCard
                label="Negative trades"
                value={statistics.negativeTradeCount}
                format="integer"
              />
              <DashboardStatCard
                label="Flat trades"
                value={statistics.flatTradeCount}
                format="integer"
              />
            </div>
          </div>
        </div>

        {/* Additional stats row */}
        <DashboardStatRow
          stats={[
            { label: "Avg trades per workspace", value: statistics.averageTradesPerWorkspace, format: "integer" },
            { label: "Most traded symbol", value: statistics.mostTradedSymbol || "—", format: "string" },
            { label: "Latest trade", value: statistics.latestTradeTimestamp ? new Date(statistics.latestTradeTimestamp).toLocaleDateString() : "—", format: "string" },
          ]}
          className="border-t border-border pt-4"
        />
      </DashboardSection>

      {/* Workspace Breakdown & Recent Activity */}
      <div className="grid gap-8 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <DashboardSection title="Workspace Breakdown">
            <WorkspaceBreakdownTable workspaces={workspaceBreakdown} />
          </DashboardSection>
        </div>

        <div className="lg:col-span-3">
          <DashboardSection title="Recent Activity">
            <RecentActivity trades={recentTrades} />
          </DashboardSection>
        </div>
      </div>
    </div>
  );
}