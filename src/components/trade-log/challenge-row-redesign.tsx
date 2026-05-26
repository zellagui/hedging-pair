"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatMoney, dateFromCreatedAt } from "@/models/trade-log/format";
import { getChallengeDashboardMetrics, getPairsByChallengeId } from "@/models/trade-log/challenges";
import type { Challenge, HedgePair, LogTrade } from "@/models/trade-log/types";
import { cn } from "@/lib/utils";

interface ChallengeRowProps {
  challenge: Challenge;
  trades: LogTrade[];
  pairs: HedgePair[];
}

function moneyTint(value: number): string {
  if (value > 0) return "text-emerald-600 dark:text-emerald-400";
  if (value < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

function statusLabel(challenge: Challenge): string {
  return challenge.status === "paid_out"
    ? "Paid"
    : challenge.status === "evaluation"
      ? "Evaluation"
      : challenge.status === "failed"
        ? "Failed"
        : challenge.status === "funded"
          ? "Funded"
          : challenge.status === "passed"
            ? "Passed"
            : challenge.status;
}

function statusBadgeColor(status: Challenge["status"]): string {
  switch (status) {
    case "evaluation":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
    case "passed":
    case "funded":
    case "paid_out":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "failed":
      return "bg-red-500/10 text-red-700 dark:text-red-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function ChallengeRowRedesign({ challenge, trades, pairs }: ChallengeRowProps) {
  const dashboard = getChallengeDashboardMetrics(challenge, trades, pairs);
  const phasesCount = getPairsByChallengeId(challenge.id, trades, pairs).length;

  const netResult = dashboard.netReal;
  const challengeProgress = challenge.status === "evaluation" ? dashboard.propRealized : 0;
  const challengeTarget = challenge.currentProfitTarget;
  const progressPercent =
    challenge.status === "evaluation" && challengeTarget > 0
      ? Math.min(100, Math.max(0, (challengeProgress / challengeTarget) * 100))
      : 0;

  const href = `/identities/${challenge.identityId}/challenges/${challenge.id}`;

  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-lg border border-border/60 bg-card px-3 py-2.5 transition-colors hover:border-border hover:bg-accent/30 active:bg-accent/50 sm:px-4"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium leading-tight">{challenge.name}</span>
            <Badge className={cn("shrink-0 text-[10px] font-medium", statusBadgeColor(challenge.status))}>
              {statusLabel(challenge)}
            </Badge>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {dateFromCreatedAt(challenge.createdAt)} · Fee {formatMoney(challenge.fee)} · {phasesCount}{" "}
            {phasesCount === 1 ? "phase" : "phases"}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">Net</p>
          <p className={cn("text-sm font-semibold tabular-nums", moneyTint(netResult))}>
            {formatMoney(netResult)}
          </p>
        </div>

        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
      </div>

      {challenge.status === "evaluation" && (
        <div className="flex items-center gap-2">
          <Progress value={progressPercent} className="h-1 flex-1" />
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {progressPercent.toFixed(0)}%
          </span>
        </div>
      )}
    </Link>
  );
}
