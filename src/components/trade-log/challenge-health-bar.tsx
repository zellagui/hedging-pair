"use client";

import type { ReactNode } from "react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { type ChallengeDashboardMetrics } from "@/models/trade-log/challenges";
import { formatMoney } from "@/models/trade-log/format";
import type { Challenge } from "@/models/trade-log/types";

type Dashboard = ChallengeDashboardMetrics;

function pctUsed(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, (used / limit) * 100);
}

function moneyTint(v: number) {
  if (v > 0) return "text-emerald-600 dark:text-emerald-400";
  if (v < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

function RiskSuffix({
  pct,
  limit,
  breached,
}: {
  pct: number;
  limit: number;
  breached: boolean;
}) {
  if (limit <= 0) return null;
  if (breached) {
    return (
      <span className="ml-1.5" aria-label="Over limit">
        🚨
      </span>
    );
  }
  if (pct > 95) {
    return (
      <span className="ml-1.5" aria-label="Critical">
        🚨
      </span>
    );
  }
  if (pct > 80) {
    return (
      <span className="ml-1.5" aria-label="Warning">
        ⚠️
      </span>
    );
  }
  return (
    <span className="ml-1.5 text-emerald-600 dark:text-emerald-400">
      ✅ Safe
    </span>
  );
}

function Tt({
  tip,
  children,
  className,
}: {
  tip: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span title={tip} className={cn("cursor-help border-b border-dotted border-muted-foreground/60", className)}>
      {children}
    </span>
  );
}

function HealthRow({
  label,
  hint,
  valueNode,
  progress,
  emptyBar,
}: {
  label: ReactNode;
  hint: string;
  valueNode: ReactNode;
  progress: ReactNode;
  emptyBar?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="w-full shrink-0 sm:w-44">
          <p className="text-xs font-medium text-foreground">{label}</p>
          <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
            {hint}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          {emptyBar ? (
            <div className="h-2.5 rounded-full bg-muted" aria-hidden />
          ) : (
            progress
          )}
        </div>
        <div className="shrink-0 text-left sm:w-56 sm:text-right">{valueNode}</div>
      </div>
    </div>
  );
}

export function ChallengeHealthBar({
  challenge,
  dashboard,
  dailyLossUsed,
  pairCount,
  openLegs,
}: {
  challenge: Challenge;
  dashboard: Dashboard;
  dailyLossUsed: number;
  pairCount: number;
  openLegs: number;
}) {
  const targetLimit = challenge.currentProfitTarget;
  const propRealized = dashboard.propRealized;
  const targetPct =
    targetLimit > 0
      ? Math.min(100, (propRealized / targetLimit) * 100)
      : 0;

  const ddLimit = challenge.maxDrawdown;
  const ddUsed = dashboard.drawdown;
  const ddPct = ddLimit > 0 ? pctUsed(ddUsed, ddLimit) : 0;
  const ddBreached = ddLimit > 0 && ddUsed > ddLimit;

  const dailyCap = challenge.dailyLossCap;
  const dailyPct = dailyCap > 0 ? pctUsed(dailyLossUsed, dailyCap) : 0;
  const dailyBreached = dailyCap > 0 && dailyLossUsed > dailyCap;

  const isEval = challenge.status === "evaluation";
  const remainingToPass =
    isEval && targetLimit > 0 ? Math.max(0, targetLimit - propRealized) : null;

  const combined = dashboard.combinedRealized;
  const netReal = dashboard.netReal;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/25 px-4 py-4 sm:px-5">
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        Challenge health
      </p>

      <div className="space-y-5">
        <HealthRow
          label={
            <Tt tip="The prop firm account P&L. Wins count toward passing the evaluation but are NOT your real money until a payout is triggered.">
              Challenge progress
            </Tt>
          }
          hint="The prop firm account progress. Wins here are not real cash — they count toward passing the evaluation."
          emptyBar={targetLimit <= 0}
          progress={
            <Progress
              value={targetPct}
              className="h-2.5 [&_[data-slot=progress-indicator]]:bg-emerald-600 dark:[&_[data-slot=progress-indicator]]:bg-emerald-500"
            />
          }
          valueNode={
            <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
              {targetLimit > 0 ? (
                <>
                  {formatMoney(propRealized)} / {formatMoney(targetLimit)}
                  <span className="ml-1.5">{targetPct.toFixed(0)}%</span>
                </>
              ) : (
                "—"
              )}
            </span>
          }
        />

        <HealthRow
          label="Drawdown risk"
          hint="Prop drawdown vs max — breaching this can fail the challenge"
          emptyBar={ddLimit <= 0}
          progress={
            <Progress
              value={ddPct}
              className={cn(
                "h-2.5",
                "[&_[data-slot=progress-indicator]]:bg-red-500 dark:[&_[data-slot=progress-indicator]]:bg-red-500"
              )}
            />
          }
          valueNode={
            <span
              className={cn(
                "inline-flex flex-wrap items-center justify-end gap-x-1 text-[11px] font-semibold tabular-nums",
                ddBreached
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
            >
              {ddLimit > 0 ? (
                <>
                  {formatMoney(ddUsed)} / {formatMoney(ddLimit)}
                  <span className="ml-1.5">{ddPct.toFixed(0)}%</span>
                  <RiskSuffix
                    pct={ddPct}
                    limit={ddLimit}
                    breached={ddBreached}
                  />
                </>
              ) : (
                "—"
              )}
            </span>
          }
        />

        <HealthRow
          label="Daily risk"
          hint="Resets each calendar day"
          emptyBar={dailyCap <= 0}
          progress={
            <Progress
              value={dailyPct}
              className="h-2.5 [&_[data-slot=progress-indicator]]:bg-amber-500 dark:[&_[data-slot=progress-indicator]]:bg-amber-500"
            />
          }
          valueNode={
            <span
              className={cn(
                "inline-flex flex-wrap items-center justify-end gap-x-1 text-[11px] font-semibold tabular-nums",
                dailyBreached
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
            >
              {dailyCap > 0 ? (
                <>
                  {formatMoney(dailyLossUsed)} / {formatMoney(dailyCap)}
                  <span className="ml-1.5">{dailyPct.toFixed(0)}%</span>
                  <RiskSuffix
                    pct={dailyPct}
                    limit={dailyCap}
                    breached={dailyBreached}
                  />
                </>
              ) : (
                "—"
              )}
            </span>
          }
        />
      </div>

      <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2 sm:gap-x-10">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span aria-hidden>💰</span>
            <Tt tip="personalRealized − challengeFee. This is what you actually made or lost on this challenge in real money — personal gains minus the fee you paid to enter this challenge.">
              Your real net
            </Tt>
          </p>
          <p
            className={cn(
              "mt-0.5 text-base font-semibold tabular-nums",
              moneyTint(netReal)
            )}
          >
            {formatMoney(netReal)}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            = personal − fee
          </p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span aria-hidden>📊</span>
            Phases logged
          </p>
          <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
            {pairCount} pairs
          </p>
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            Open legs
          </p>
          <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
            {openLegs}
          </p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span aria-hidden>🎯</span>
            To pass
          </p>
          <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
            {remainingToPass != null
              ? `${formatMoney(remainingToPass)} remaining`
              : "—"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            (prop progress only)
          </p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span aria-hidden>⚖️</span>
            <Tt tip="propRealized + personalRealized on closed legs. Shows how balanced the hedge is. This is NOT your take-home — use Personal P&L for real money.">
              Hedge balance
            </Tt>
          </p>
          <p
            className={cn(
              "mt-0.5 text-base font-semibold tabular-nums",
              moneyTint(combined)
            )}
          >
            {formatMoney(combined)} combined
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            (prop + personal)
          </p>
        </div>
      </div>
    </div>
  );
}
