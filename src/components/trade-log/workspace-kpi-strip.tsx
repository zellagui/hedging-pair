"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/models/trade-log/format";
import { calculateWorkspaceMetrics } from "@/models/trade-log/workspace-metrics";
import { useTradingStore } from "@/models/trade-log/store";

interface WorkspaceKpiStripProps {
  selectedWorkspaceId: string | null;
  className?: string;
}

function moneyTint(value: number): string {
  if (value > 0) return "text-green-600 dark:text-green-400";
  if (value < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

export function WorkspaceKpiStrip({ selectedWorkspaceId, className }: WorkspaceKpiStripProps) {
  const { trades, challenges, pairs, sessions, identities } = useTradingStore(
    useShallow((s) => ({
      trades: s.trades,
      challenges: s.challenges,
      pairs: s.pairs,
      sessions: s.sessions,
      identities: s.identities,
    }))
  );

  const metrics = useMemo(() => {
    return calculateWorkspaceMetrics(
      selectedWorkspaceId,
      trades,
      challenges,
      pairs,
      sessions,
      identities
    );
  }, [selectedWorkspaceId, trades, challenges, pairs, sessions, identities]);

  const selectedWorkspace = selectedWorkspaceId 
    ? identities.find(i => i.id === selectedWorkspaceId)
    : null;

  const title = selectedWorkspace?.name || "All Workspaces";
  
  return (
    <div className={className}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {selectedWorkspace 
            ? "Performance metrics for this workspace" 
            : "Combined performance across all workspaces"}
        </p>
      </div>
      
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Book After Fees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold tabular-nums ${moneyTint(metrics.bookAfterFees)}`}>
              {formatMoney(metrics.bookAfterFees)}
            </div>
            <CardDescription className="text-xs">
              Net P&L minus challenge fees
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Personal Legs P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold tabular-nums ${moneyTint(metrics.personalRealized)}`}>
              {formatMoney(metrics.personalRealized)}
            </div>
            <CardDescription className="text-xs">
              Hedge trades (realized)
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Firm-side P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold tabular-nums ${moneyTint(metrics.challengeSideRealized)}`}>
              {formatMoney(metrics.challengeSideRealized)}
            </div>
            <CardDescription className="text-xs">
              Prop trades (realized)
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Runways</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tabular-nums">
              {metrics.activeRunways}
            </div>
            <CardDescription className="text-xs">
              Evaluation phase challenges
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failed Challenges</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tabular-nums">
              {metrics.failedChallenges}
            </div>
            <CardDescription className="text-xs">
              Terminated challenges
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Fees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold tabular-nums ${moneyTint(metrics.totalChallengeFees)}`}>
              {formatMoney(metrics.totalChallengeFees)}
            </div>
            <CardDescription className="text-xs">
              All challenge fees
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}