"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { challengeStatusLabel } from "@/models/trade-log/challenges";
import { formatMoney, localTodayYmd } from "@/models/trade-log/format";
import type {
  WorkspaceOverviewChallengeRow,
  WorkspaceOverviewDigest,
} from "@/models/trade-log/overview-digest";
import { readableChallengeStatusesLine } from "@/models/trade-log/overview-digest";
import { displayPnl } from "@/models/trade-log/pnl";
import { isPersonalTrade } from "@/models/trade-log/pnl";

type Props = {
  digest: WorkspaceOverviewDigest;
};

export function WorkspaceOverviewPanels({ digest }: Props) {
  const { side, totalsInScope } = digest;
  const propBlended =
    side.challengeSideRealized + side.challengeSideUnrealized;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-linear-to-br from-muted/50 via-muted/10 to-muted/35 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Workspace snapshot
            </p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              {digest.identityName}
            </p>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
              {readableChallengeStatusesLine(digest.countsByChallengeStatus)}
              {digest.liveChallengeCount > 0 ? (
                <span className="text-foreground">
                  {" "}
                  · {digest.liveChallengeCount} active runway
                  {digest.liveChallengeCount === 1 ? "" : "s"}
                </span>
              ) : null}
            </p>
            {digest.workspaceNote.trim() !== "" ? (
              <p className="mt-2 max-w-2xl text-xs text-muted-foreground">
                Note:{" "}
                <span className="text-foreground/90">{digest.workspaceNote}</span>
              </p>
            ) : null}
          </div>
          <Badge variant={digest.liveChallengeCount > 0 ? "default" : "secondary"}>
            {digest.totalsInScope.openHedgePairs} open hedge
            {digest.totalsInScope.openHedgePairs === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InsightCard
          title="Book after fees"
          hint="Combined prop + hedge legs minus one-time fees logged per challenge."
          value={digest.netAfterTrackedFees}
          toneMoney
        />
        <InsightCard
          title="Firm-side P&amp;L"
          hint="Official prop trades (paired + orphaned) blended realized and open marks."
          value={propBlended}
          toneMoney
        />
        <InsightCard
          title="Personal legs"
          hint="Mirrors and discretionary personal trades attributed to this workspace."
          value={digest.personalBlendedGross}
          toneMoney
        />
        <InsightCard
          title="Today's touch"
          hint={`Legs counted when createdAt or updatedAt starts with ${localTodayYmd()} — matches the ISO YYYY-MM-DD prefix, same rule as workspace digest.`}
          value={totalsInScope.tradesTouchingCalendarToday}
          format="integer"
          sub={`${totalsInScope.openTradeLegs} open legs · ${totalsInScope.openSessionsScoped} sessions still open`}
        />
      </section>

      <p className="-mt-1 text-[0.65rem] text-muted-foreground">
        Gross blended before fees:&nbsp;
        <span className="tabular-nums text-foreground/80">
          {formatMoney(digest.grossBlended)}
        </span>
        {" "}
        — fees modeled:&nbsp;
        <span className="tabular-nums text-foreground/80">
          −{formatMoney(digest.feesLoggedOnWorkspaceChallenges)}
        </span>
      </p>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Live challenges</CardTitle>
            <CardDescription>
              Ordered by urgency: breached profit targets first, highest drawdown
              use versus max loss, then distance to payout target during
              evaluations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {digest.liveChallengeRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active runway in this workspace. Create an evaluation row or open the challenge board to revive something archived.
              </p>
            ) : (
              <ul className="space-y-3">
                {digest.liveChallengeRows.map((row) => (
                  <LiveChallengeSnippet key={row.challenge.id} row={row} />
                ))}
              </ul>
            )}
            {digest.inactiveChallengeCount > 0 ? (
              <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                {digest.inactiveChallengeCount} archived or terminal challenge
                {digest.inactiveChallengeCount === 1 ? "" : "s"}
                {digest.archivedSummary.sampleNames.length ? (
                  <>
                    : {" "}
                    <span className="text-foreground/80">
                      {digest.archivedSummary.sampleNames.join(", ")}
                    </span>
                    {digest.archivedSummary.ids.length >
                    digest.archivedSummary.sampleNames.length
                      ? "…"
                      : ""}
                  </>
                ) : null}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Latest journal legs</CardTitle>
            <CardDescription>
              Most recently updated fills in your workspace—not the global firm list.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {digest.recentTrades.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No trades attributed to this workspace yet.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {digest.recentTrades.map((t) => {
                  const { kind, value } = displayPnl(t);
                  const side = isPersonalTrade(t) ? "Hedge/personal" : "Prop firm";
                  return (
                    <li key={t.id}>
                      <Link
                        href={`/trades/${t.id}/edit`}
                        className="block rounded-lg border border-border bg-card/60 px-3 py-2 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              <span className="font-mono text-xs">{t.symbol}</span>{" "}
                              <span className="uppercase">{t.direction}</span>
                              <Badge variant="outline" className="ml-2 py-0 text-[10px]">
                                {side}
                              </Badge>
                            </p>
                            <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
                              {kind === "realized"
                                ? "Realized closed leg"
                                : "Open marks"}
                              {" · "}
                              Updated {t.updatedAt.slice(0, 16)}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "whitespace-nowrap text-sm tabular-nums font-medium",
                              value > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : value < 0
                                  ? "text-red-600 dark:text-red-400"
                                  : ""
                            )}
                          >
                            {kind === "unrealized" ? "~" : ""}
                            {formatMoney(value)}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <span>
          Hedge pairs — open{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {totalsInScope.openHedgePairs}
          </span>
          {" · "}
          settled{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {totalsInScope.closedHedgePairs}
          </span>
        </span>
        <span>
          Scoped journal legs:&nbsp;
          <span className="font-semibold tabular-nums text-foreground">
            {totalsInScope.tradeLegs}
          </span>
        </span>
        <Link
          href={`/identities/${digest.identityId}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Workspace hub →
        </Link>
      </footer>
    </div>
  );
}

function InsightCard(props: {
  title: string;
  hint?: string;
  value: number;
  format?: "money" | "integer";
  toneMoney?: boolean;
  sub?: string;
}) {
  const {
    title,
    hint,
    value,
    format = "money",
    toneMoney,
    sub,
  } = props;
  const display =
    format === "integer"
      ? String(Math.round(value))
      : formatMoney(value);

  let tint = "";
  if (format === "money" && toneMoney !== false) {
    if (value > 0) tint = "text-emerald-600 dark:text-emerald-400";
    else if (value < 0) tint = "text-red-600 dark:text-red-400";
  }

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            title={hint}
          >
            {title}
          </p>
          <p
            className={cn(
              "mt-1 text-2xl font-semibold tracking-tight tabular-nums",
              tint || "text-foreground"
            )}
          >
            {display}
          </p>
          {sub != null ? (
            <p className="mt-1 text-[0.7rem] text-muted-foreground">{sub}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LiveChallengeSnippet({ row }: { row: WorkspaceOverviewChallengeRow }) {
  const { challenge: ch, metrics: m } = row;
  const badgeVariant =
    ch.status === "failed"
      ? "destructive"
      : ch.status === "evaluation"
        ? "outline"
        : "secondary";

  const ddBar = Math.min(100, row.drawdownPctOfMax * 100);
  const dailyBar = Math.min(100, row.dailyLossPctOfCap * 100);

  return (
    <li className="rounded-lg border border-border bg-muted/15 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/identities/${ch.identityId}/challenges/${ch.id}`}
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {ch.name}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant={badgeVariant} className="text-[10px]">
              {challengeStatusLabel(ch.status)}
            </Badge>
            {m.targetReachedEval ? (
              <Badge className="text-[10px]" variant="default">
                Eval target crossed
              </Badge>
            ) : null}
            <span className="text-[0.7rem] text-muted-foreground">
              Fee {formatMoney(ch.fee)} · {row.openPairsCount}{" "}
              {row.openPairsCount === 1 ? "pair" : "pairs"} open ·{" "}
              {row.openLegsCount} open legs
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
            Drawdown vs max
          </p>
          {ch.maxDrawdown > 0 ? (
            <>
              <Progress
                className={cn(
                  "mt-1 h-2",
                  row.drawdownPctOfMax >= 1
                    ? "bg-red-950/90 [&>div]:bg-red-500"
                    : row.drawdownPctOfMax >= 0.85
                      ? "[&>div]:bg-amber-500"
                      : "[&>div]:bg-emerald-500"
                )}
                value={ddBar}
              />
              <p className="mt-1 text-[0.7rem] text-muted-foreground">
                {formatMoney(m.drawdown)} / {formatMoney(ch.maxDrawdown)}{" "}
                <span className="tabular-nums">
                  ({(row.drawdownPctOfMax * 100).toFixed(0)}
                  %)
                </span>
              </p>
            </>
          ) : (
            <p className="mt-1 text-[0.7rem] italic text-muted-foreground">
              No max drawdown on file—mirror the vendor rule so this bar lights up before you breach.
            </p>
          )}
        </div>
        <div>
          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
            Daily loss ({localTodayCaption()}) vs cap
          </p>
          {ch.dailyLossCap > 0 ? (
            <>
              <Progress
                className={cn(
                  "mt-1 h-2",
                  row.dailyLossPctOfCap >= 1
                    ? "[&>div]:bg-red-500"
                    : row.dailyLossPctOfCap >= 0.8
                      ? "[&>div]:bg-amber-500"
                      : "[&>div]:bg-slate-500/40 dark:[&>div]:bg-slate-500/50"
                )}
                value={dailyBar || 0}
              />
              <p className="mt-1 text-[0.7rem] text-muted-foreground">
                Firm legs closed today (losses accumulate toward the calendar cap).
              </p>
            </>
          ) : (
            <p className="mt-1 text-[0.7rem] italic text-muted-foreground">
              Daily cap not set—add it on the challenge if this firm gates by calendar day losses.
            </p>
          )}
        </div>
      </div>

      {ch.status === "evaluation" && ch.currentProfitTarget > 0 ? (
        <p className="mt-3 text-xs">
          Prop realized toward target:&nbsp;
          <span className="font-semibold tabular-nums text-foreground">
            {formatMoney(m.propRealized)}
          </span>
          {" "}
          / {formatMoney(ch.currentProfitTarget)} — remaining gap{" "}
          <span
            className={cn(
              "font-semibold tabular-nums",
              m.distanceToTarget <= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : ""
            )}
          >
            {formatMoney(m.distanceToTarget)}
          </span>
        </p>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Prop cumulative realized:&nbsp;
          <span className="font-medium tabular-nums text-foreground">
            {formatMoney(m.propRealized)}
          </span>
          {" "}· Hedge personal unrealized:&nbsp;
          <span className="font-medium tabular-nums">
            ~
            {formatMoney(m.personalRunning - m.personalRealized)}
          </span>
        </p>
      )}
    </li>
  );
}

function localTodayCaption() {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());
}