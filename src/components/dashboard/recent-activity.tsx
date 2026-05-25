import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/models/trade-log/format";
import { isPersonalTrade } from "@/models/trade-log/pnl";
import type { LogTrade } from "@/models/trade-log/types";
import { DashboardEmptyState } from "./dashboard-card";

interface RecentActivityProps {
  trades: LogTrade[];
  className?: string;
}

export function RecentActivity({ trades, className }: RecentActivityProps) {
  if (trades.length === 0) {
    return (
      <DashboardEmptyState
        message="No recent activity"
        description="Your latest trades will appear here"
        className={className}
      />
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {trades.map((trade) => (
        <RecentTradeItem key={trade.id} trade={trade} />
      ))}
    </div>
  );
}

function RecentTradeItem({ trade }: { trade: LogTrade }) {
  const isPersonal = isPersonalTrade(trade);
  const pnl = trade.directPnl ?? 0;
  const pnlColorClass = getPnlColorClass(pnl);
  const isRealized = trade.directPnl !== null && trade.exitPrice !== null;

  return (
    <Link
      href={`/trades/${trade.id}/edit`}
      className="block rounded-lg border border-border bg-card/60 px-4 py-3 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm font-medium text-foreground">
              {trade.symbol}
            </span>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {trade.direction}
            </span>
            <Badge
              variant="outline"
              className="text-[10px] py-0 px-1.5"
            >
              {isPersonal ? "Personal" : "Prop"}
            </Badge>
            {!isRealized && (
              <Badge
                variant="secondary"
                className="text-[10px] py-0 px-1.5"
              >
                Open
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Size: {trade.size.toLocaleString()}</span>
            <span>Entry: {formatMoney(trade.entryPrice)}</span>
            {trade.exitPrice && (
              <span>Exit: {formatMoney(trade.exitPrice)}</span>
            )}
          </div>
          
          <p className="mt-1 text-xs text-muted-foreground">
            {isRealized ? "Closed" : "Open position"}
            {" · "}
            {formatRelativeTime(trade.updatedAt)}
          </p>
        </div>

        <div className="text-right">
          <p className={cn("text-sm font-medium tabular-nums", pnlColorClass)}>
            {!isRealized && "~"}
            {formatMoney(pnl)}
          </p>
          <p className="text-xs text-muted-foreground">
            {isRealized ? "Realized" : "Unrealized"}
          </p>
        </div>
      </div>

      {trade.notes && (
        <p className="mt-2 text-xs text-muted-foreground/80 truncate">
          {trade.notes}
        </p>
      )}
    </Link>
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

  if (diffDays > 7) {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }
  if (diffDays > 0) {
    return `${diffDays}d ago`;
  }
  if (diffHours > 0) {
    return `${diffHours}h ago`;
  }
  if (diffMinutes > 5) {
    return `${diffMinutes}m ago`;
  }
  return "Just now";
}

// Compact version for smaller spaces
interface CompactRecentActivityProps {
  trades: LogTrade[];
  limit?: number;
  className?: string;
}

export function CompactRecentActivity({
  trades,
  limit = 5,
  className,
}: CompactRecentActivityProps) {
  const recentTrades = trades.slice(0, limit);

  if (recentTrades.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        No recent trades
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {recentTrades.map((trade) => (
        <div key={trade.id} className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="font-mono text-xs text-foreground">
              {trade.symbol}
            </span>
            <span className="text-xs uppercase text-muted-foreground">
              {trade.direction}
            </span>
            <Badge
              variant={isPersonalTrade(trade) ? "outline" : "secondary"}
              className="text-[9px] py-0 px-1"
            >
              {isPersonalTrade(trade) ? "P" : "F"}
            </Badge>
          </div>
          <span
            className={cn(
              "text-xs font-medium tabular-nums",
              getPnlColorClass(trade.directPnl ?? 0)
            )}
          >
            {trade.directPnl !== null ? formatMoney(trade.directPnl) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}