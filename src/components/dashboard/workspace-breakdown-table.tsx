import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { formatMoney } from "@/models/trade-log/format";
import type { WorkspaceBreakdownRow } from "@/models/trade-log/workspace-metrics";
import { aggregateWorkspaceBreakdownTotals } from "@/models/trade-log/workspace-metrics";
import { useTradingStore } from "@/models/trade-log/store";
import { DashboardEmptyState } from "./dashboard-card";

interface WorkspaceBreakdownTableProps {
  workspaces: WorkspaceBreakdownRow[];
  className?: string;
}

function WorkspaceLink({ identityId, children, className }: { 
  identityId: string; 
  children: React.ReactNode; 
  className?: string;
}) {
  const router = useRouter();
  const setActiveIdentityId = useTradingStore((s) => s.setActiveIdentityId);
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setActiveIdentityId(identityId);
    router.push("/challenges");
  };
  
  return (
    <button onClick={handleClick} className={className}>
      {children}
    </button>
  );
}

export function WorkspaceBreakdownTable({
  workspaces,
  className,
}: WorkspaceBreakdownTableProps) {
  if (workspaces.length === 0) {
    return (
      <DashboardEmptyState
        message="No workspaces found"
        description="Create a workspace to start tracking your trading activities"
        className={className}
      />
    );
  }

  const totals = aggregateWorkspaceBreakdownTotals(workspaces);

  return (
    <div className={cn("rounded-lg border border-border bg-card shadow-sm", className)}>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-lg md:block">
        <table className="w-full">
          {/* Two-tier headers for grouped columns */}
          <thead>
            {/* Main header row */}
            <tr className="border-b border-border bg-muted/30">
              <th rowSpan={2} className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground border-r border-border">
                Workspace
              </th>
              <th colSpan={3} className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground border-r border-border">
                Challenge KPIs
              </th>
              <th colSpan={3} className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground border-r border-border">
                Challenges
              </th>
              <th colSpan={3} className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Activity
              </th>
            </tr>
            {/* Sub header row */}
            <tr className="bg-muted/30">
              <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Fund in eval</th>
              <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Closed profit</th>
              <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground border-r border-border">Net result</th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Total</th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Active</th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground border-r border-border">Failed</th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Pers.</th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Prop</th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Latest</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {workspaces.map((workspace) => (
              <WorkspaceTableRow key={workspace.identity.id} workspace={workspace} />
            ))}
            {/* Totals footer row */}
            <TotalFooterRow totals={totals} />
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 p-4 md:hidden">
        {workspaces.map((workspace) => (
          <WorkspaceCard key={workspace.identity.id} workspace={workspace} />
        ))}
        {/* Mobile totals card */}
        <div className="mt-4 rounded-lg border-2 border-dashed border-border bg-muted/20 p-4">
          <h4 className="mb-2 text-sm font-medium text-muted-foreground">Portfolio Totals</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Closed profit:</span>
              <span className={cn("ml-2 font-semibold tabular-nums", getPnlColorClass(totals.totalClosedProfit))}>
                {formatMoney(totals.totalClosedProfit)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Net result:</span>
              <span className={cn("ml-2 font-semibold tabular-nums", getPnlColorClass(totals.totalBookAfterFees))}>
                {formatMoney(totals.totalBookAfterFees)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function fundInEvalDisplay(value: number): number {
  return value > 0 ? -value : 0;
}

function WorkspaceTableRow({ workspace }: { workspace: WorkspaceBreakdownRow }) {
  const {
    identity,
    fundInEval,
    closedProfit,
    bookAfterFees,
    challengeCount,
    activeChallenges,
    failedChallenges,
    personalTradeCount,
    challengeTradeCount,
    latestActivity,
  } = workspace;

  const fundOutflow = fundInEvalDisplay(fundInEval);
  const closedColorClass = getPnlColorClass(closedProfit);
  const netColorClass = getPnlColorClass(bookAfterFees);

  return (
    <tr className="hover:bg-muted/10 transition-colors">
      <td className="px-4 py-4 border-r border-border">
        <WorkspaceLink
          identityId={identity.id}
          className="font-medium text-primary hover:underline text-left"
        >
          {identity.name}
        </WorkspaceLink>
        {identity.note && (
          <p className="mt-1 text-xs text-muted-foreground truncate max-w-xs">
            {identity.note}
          </p>
        )}
      </td>
      <td className="px-3 py-4 text-right tabular-nums text-sm text-red-600 dark:text-red-400">
        {formatMoney(fundOutflow)}
      </td>
      <td className={cn("px-3 py-4 text-right tabular-nums text-sm", closedColorClass)}>
        {formatMoney(closedProfit)}
      </td>
      <td className={cn("px-3 py-4 text-right tabular-nums text-sm font-medium border-r border-border", netColorClass)}>
        {formatMoney(bookAfterFees)}
      </td>
      <td className="px-3 py-4 text-center tabular-nums text-sm text-foreground">
        {challengeCount}
      </td>
      <td className="px-3 py-4 text-center tabular-nums text-sm">
        {activeChallenges > 0 ? (
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
            {activeChallenges}
          </span>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </td>
      <td className="px-3 py-4 text-center tabular-nums text-sm border-r border-border">
        {failedChallenges > 0 ? (
          <span className="text-red-600 dark:text-red-400 font-medium">
            {failedChallenges}
          </span>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </td>
      <td className="px-3 py-4 text-center tabular-nums text-sm text-foreground">
        {personalTradeCount}
      </td>
      <td className="px-3 py-4 text-center tabular-nums text-sm text-foreground">
        {challengeTradeCount}
      </td>
      <td className="px-3 py-4 text-center text-xs text-muted-foreground">
        {latestActivity ? formatRelativeTime(latestActivity) : "—"}
      </td>
    </tr>
  );
}

// Totals footer row component
function TotalFooterRow({ totals }: { totals: ReturnType<typeof aggregateWorkspaceBreakdownTotals> }) {
  const fundOutflow = fundInEvalDisplay(totals.totalFundInEval);
  const closedColorClass = getPnlColorClass(totals.totalClosedProfit);
  const netColorClass = getPnlColorClass(totals.totalBookAfterFees);

  return (
    <tr className="border-t-2 border-border bg-muted/20 font-medium">
      <td className="px-4 py-4 border-r border-border text-sm font-semibold text-foreground">
        All workspaces
      </td>
      <td className="px-3 py-4 text-right tabular-nums text-sm font-semibold text-red-600 dark:text-red-400">
        {formatMoney(fundOutflow)}
      </td>
      <td className={cn("px-3 py-4 text-right tabular-nums text-sm font-semibold", closedColorClass)}>
        {formatMoney(totals.totalClosedProfit)}
      </td>
      <td className={cn("px-3 py-4 text-right tabular-nums text-sm font-bold border-r border-border", netColorClass)}>
        {formatMoney(totals.totalBookAfterFees)}
      </td>
      <td className="px-3 py-4 text-center tabular-nums text-sm font-semibold text-foreground">
        {totals.totalChallengeCount}
      </td>
      <td className="px-3 py-4 text-center tabular-nums text-sm font-semibold text-emerald-600 dark:text-emerald-400">
        {totals.totalActiveChallenges}
      </td>
      <td className="px-3 py-4 text-center tabular-nums text-sm font-semibold text-red-600 dark:text-red-400 border-r border-border">
        {totals.totalFailedChallenges}
      </td>
      <td className="px-3 py-4 text-center tabular-nums text-sm font-semibold text-foreground">
        {totals.totalPersonalTrades}
      </td>
      <td className="px-3 py-4 text-center tabular-nums text-sm font-semibold text-foreground">
        {totals.totalChallengeTrades}
      </td>
      <td className="px-3 py-4 text-center text-xs text-muted-foreground">
        —
      </td>
    </tr>
  );
}

function WorkspaceCard({ workspace }: { workspace: WorkspaceBreakdownRow }) {
  const {
    identity,
    fundInEval,
    closedProfit,
    bookAfterFees,
    challengeCount,
    activeChallenges,
    failedChallenges,
    personalTradeCount,
    challengeTradeCount,
    latestActivity,
  } = workspace;

  const fundOutflow = fundInEvalDisplay(fundInEval);
  const netColorClass = getPnlColorClass(bookAfterFees);

  return (
    <div className="rounded-lg border border-border bg-card/50 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <WorkspaceLink
            identityId={identity.id}
            className="font-semibold text-primary hover:underline text-left"
          >
            {identity.name}
          </WorkspaceLink>
          {identity.note && (
            <p className="mt-1 text-xs text-muted-foreground">{identity.note}</p>
          )}
        </div>
        <div className="text-right">
          <p className={cn("text-lg font-bold tabular-nums", netColorClass)}>
            {formatMoney(bookAfterFees)}
          </p>
          <p className="text-xs text-muted-foreground">Net result</p>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Challenge KPIs</h4>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground">Fund in eval:</span>
            <span className="ml-2 font-semibold tabular-nums text-red-600 dark:text-red-400">
              {formatMoney(fundOutflow)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Closed profit:</span>
            <span className={cn("ml-2 font-semibold tabular-nums", getPnlColorClass(closedProfit))}>
              {formatMoney(closedProfit)}
            </span>
          </div>
        </div>
      </div>

      {/* Challenges section */}
      <div className="mb-4">
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Challenges</h4>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground">Total:</span>
            <span className="ml-2 font-semibold tabular-nums text-foreground">
              {challengeCount}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Active:</span>
            <span
              className={cn(
                "ml-2 font-semibold tabular-nums",
                activeChallenges > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground"
              )}
            >
              {activeChallenges}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Failed:</span>
            <span
              className={cn(
                "ml-2 font-semibold tabular-nums",
                failedChallenges > 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-muted-foreground"
              )}
            >
              {failedChallenges}
            </span>
          </div>
        </div>
      </div>

      {/* Activity footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border text-xs text-muted-foreground">
        <span>
          {personalTradeCount + challengeTradeCount} trades ({personalTradeCount} pers, {challengeTradeCount} prop)
        </span>
        {latestActivity && (
          <span>{formatRelativeTime(latestActivity)}</span>
        )}
      </div>
    </div>
  );
}

function getPnlColorClass(value: number): string {
  if (value > 0) {
    return "text-emerald-600 dark:text-emerald-400";
  }
  if (value < 0) {
    return "text-red-600 dark:text-red-400";
  }
  return "text-foreground";
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffDays > 0) {
    return `${diffDays}d ago`;
  }
  if (diffHours > 0) {
    return `${diffHours}h ago`;
  }
  if (diffMinutes > 0) {
    return `${diffMinutes}m ago`;
  }
  return "Just now";
}