import Link from "next/link";

import { cn } from "@/lib/utils";
import { formatMoney } from "@/models/trade-log/format";
import type { WorkspaceBreakdownRow } from "@/models/trade-log/dashboard-metrics";
import { DashboardEmptyState } from "./dashboard-card";

interface WorkspaceBreakdownTableProps {
  workspaces: WorkspaceBreakdownRow[];
  className?: string;
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

  return (
    <div className={cn("space-y-4", className)}>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-lg border border-border md:block">
        <table className="w-full">
          <thead className="bg-muted/30">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Workspace
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total P&L
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Book After Fees
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Challenges
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Active
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Failed
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Personal
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Firm
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Latest Activity
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {workspaces.map((workspace) => (
              <WorkspaceTableRow key={workspace.identity.id} workspace={workspace} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {workspaces.map((workspace) => (
          <WorkspaceCard key={workspace.identity.id} workspace={workspace} />
        ))}
      </div>
    </div>
  );
}

function WorkspaceTableRow({ workspace }: { workspace: WorkspaceBreakdownRow }) {
  const {
    identity,
    totalRealized,
    bookAfterFees,
    challengeCount,
    activeChallenges,
    failedChallenges,
    personalTradeCount,
    challengeTradeCount,
    latestActivity,
  } = workspace;

  const pnlColorClass = getPnlColorClass(totalRealized);
  const bookColorClass = getPnlColorClass(bookAfterFees);

  return (
    <tr className="hover:bg-muted/20 transition-colors">
      <td className="px-4 py-3">
        <Link
          href={`/identities/${identity.id}`}
          className="font-medium text-primary hover:underline"
        >
          {identity.name}
        </Link>
        {identity.note && (
          <p className="mt-1 text-xs text-muted-foreground truncate max-w-xs">
            {identity.note}
          </p>
        )}
      </td>
      <td className={cn("px-4 py-3 text-right tabular-nums", pnlColorClass)}>
        {formatMoney(totalRealized)}
      </td>
      <td className={cn("px-4 py-3 text-right tabular-nums", bookColorClass)}>
        {formatMoney(bookAfterFees)}
      </td>
      <td className="px-4 py-3 text-center tabular-nums text-foreground">
        {challengeCount}
      </td>
      <td className="px-4 py-3 text-center tabular-nums">
        {activeChallenges > 0 ? (
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
            {activeChallenges}
          </span>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </td>
      <td className="px-4 py-3 text-center tabular-nums">
        {failedChallenges > 0 ? (
          <span className="text-red-600 dark:text-red-400 font-medium">
            {failedChallenges}
          </span>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </td>
      <td className="px-4 py-3 text-center tabular-nums text-foreground">
        {personalTradeCount}
      </td>
      <td className="px-4 py-3 text-center tabular-nums text-foreground">
        {challengeTradeCount}
      </td>
      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
        {latestActivity ? formatRelativeTime(latestActivity) : "—"}
      </td>
    </tr>
  );
}

function WorkspaceCard({ workspace }: { workspace: WorkspaceBreakdownRow }) {
  const {
    identity,
    totalRealized,
    bookAfterFees,
    challengeCount,
    activeChallenges,
    failedChallenges,
    personalTradeCount,
    challengeTradeCount,
    latestActivity,
  } = workspace;

  const pnlColorClass = getPnlColorClass(totalRealized);
  const bookColorClass = getPnlColorClass(bookAfterFees);

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/identities/${identity.id}`}
            className="font-medium text-primary hover:underline"
          >
            {identity.name}
          </Link>
          {identity.note && (
            <p className="mt-1 text-xs text-muted-foreground">{identity.note}</p>
          )}
        </div>
        <div className="text-right">
          <p className={cn("text-sm font-medium tabular-nums", pnlColorClass)}>
            {formatMoney(totalRealized)}
          </p>
          <p className="text-xs text-muted-foreground">Total P&L</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-muted-foreground">Book after fees:</span>
          <span className={cn("ml-2 font-medium tabular-nums", bookColorClass)}>
            {formatMoney(bookAfterFees)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Challenges:</span>
          <span className="ml-2 font-medium tabular-nums text-foreground">
            {challengeCount}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Active:</span>
          <span
            className={cn(
              "ml-2 font-medium tabular-nums",
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
              "ml-2 font-medium tabular-nums",
              failedChallenges > 0
                ? "text-red-600 dark:text-red-400"
                : "text-muted-foreground"
            )}
          >
            {failedChallenges}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Personal trades:</span>
          <span className="ml-2 font-medium tabular-nums text-foreground">
            {personalTradeCount}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Firm trades:</span>
          <span className="ml-2 font-medium tabular-nums text-foreground">
            {challengeTradeCount}
          </span>
        </div>
      </div>

      {latestActivity && (
        <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
          Latest activity: {formatRelativeTime(latestActivity)}
        </div>
      )}
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