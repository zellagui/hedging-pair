"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { ChallengeFormDialog } from "@/components/trade-log/challenge-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  challengeMatchesActivityDateRange,
  challengeStatusLabel,
  estimatePersonalNotionalForChallenge,
  getChallengeDashboardMetrics,
  getPairsByChallengeId,
  isChallengeLiveStatus,
} from "@/models/trade-log/challenges";
import { formatMoney } from "@/models/trade-log/format";
import { useTradingStore } from "@/models/trade-log/store";
import type { Challenge, ChallengeStatus, HedgePair, LogTrade } from "@/models/trade-log/types";
import { ChevronRight } from "lucide-react";

function moneyTint(v: number) {
  if (v > 0) return "text-emerald-600 dark:text-emerald-400";
  if (v < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

function statusLabel(c: Challenge) {
  return c.status === "paid_out" ? "Paid" : challengeStatusLabel(c.status);
}

function statusBadge(c: Challenge) {
  const label = statusLabel(c);
  const { status } = c;
  const emoji =
    status === "evaluation"
      ? "🔵"
      : status === "failed"
        ? "🔴"
        : status === "archived"
          ? "🟠"
          : status === "funded" || status === "passed" || status === "paid_out"
            ? "🟢"
            : "⚪";
  const inner = (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden>{emoji}</span>
      <span>{label}</span>
    </span>
  );
  if (status === "evaluation") {
    return (
      <Badge variant="secondary" className="text-[11px] font-medium">
        {inner}
      </Badge>
    );
  }
  if (status === "funded" || status === "passed" || status === "paid_out") {
    return (
      <Badge className="border-emerald-600/35 bg-emerald-600/12 text-[11px] font-medium text-emerald-900 dark:text-emerald-100">
        {inner}
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="destructive" className="text-[11px] font-medium">
        {inner}
      </Badge>
    );
  }
  if (status === "archived") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/50 text-[11px] font-medium text-amber-950 dark:text-amber-100"
      >
        {inner}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[11px] font-medium">
      {inner}
    </Badge>
  );
}

const STATUS_FILTER_OPTIONS: { value: "all" | ChallengeStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "evaluation", label: "Evaluation" },
  { value: "passed", label: "Passed" },
  { value: "funded", label: "Funded" },
  { value: "failed", label: "Failed" },
  { value: "paid_out", label: "Paid out" },
  { value: "archived", label: "Archived" },
];

function ListKpiTile({
  label,
  value,
  hint,
  valueClassName,
}: {
  label: string;
  value: string;
  hint?: string;
  valueClassName?: string;
}) {
  return (
    <div
      className="rounded-md border border-border bg-card px-2.5 py-2 shadow-sm"
      title={hint}
    >
      <p className="text-[9px] font-medium uppercase leading-tight tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-0.5 text-base font-semibold leading-tight tabular-nums text-foreground sm:text-[15px] ${valueClassName ?? ""}`}
      >
        {value}
      </p>
    </div>
  );
}

export function ChallengesIndexPage({
  scopedWorkspaceId = null,
  scopedMode = false,
}: {
  scopedWorkspaceId?: string | null;
  scopedMode?: boolean;
} = {}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ChallengeStatus>("all");
  const [fromYmd, setFromYmd] = useState("");
  const [toYmd, setToYmd] = useState("");

  const { challenges: allChallenges, trades, pairs, identities } = useTradingStore(
    useShallow((s) => ({
      challenges: s.challenges,
      trades: s.trades,
      pairs: s.pairs,
      identities: s.identities,
    }))
  );

  const challenges = useMemo(() => {
    if (scopedWorkspaceId == null || scopedWorkspaceId.trim() === "") {
      return allChallenges;
    }
    return allChallenges.filter((c) => c.identityId === scopedWorkspaceId);
  }, [allChallenges, scopedWorkspaceId]);

  const identityNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of identities) m.set(i.id, i.name);
    return m;
  }, [identities]);

  const sorted = useMemo(() => {
    return [...challenges].sort((a, b) => {
      const da = a.disbursementAt?.trim() ?? "";
      const db = b.disbursementAt?.trim() ?? "";
      if (da !== db) {
        if (da === "") return 1;
        if (db === "") return -1;
        const disburseCmp = db.localeCompare(da);
        if (disburseCmp !== 0) return disburseCmp;
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [challenges]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sorted.filter((c) => {
      if (needle && !c.name.toLowerCase().includes(needle)) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!challengeMatchesActivityDateRange(c, trades, pairs, fromYmd, toYmd)) {
        return false;
      }
      return true;
    });
  }, [sorted, q, statusFilter, fromYmd, toYmd, trades, pairs]);

  const listKpis = useMemo(() => {
    let live = 0;
    let phases = 0;
    let fees = 0;
    let hedgeNotional = 0;
    let netRealExclEvaluation = 0;
    let evalNetReal = 0;
    for (const c of filtered) {
      if (isChallengeLiveStatus(c.status)) live++;
      phases += getPairsByChallengeId(c.id, trades, pairs).length;
      fees += c.fee;
      hedgeNotional += estimatePersonalNotionalForChallenge(c.id, trades, pairs);
      const d = getChallengeDashboardMetrics(c, trades, pairs);
      if (c.status === "evaluation") {
        evalNetReal += d.netReal;
      } else {
        netRealExclEvaluation += d.netReal;
      }
    }
    const totalInvested = fees + hedgeNotional;
    return {
      count: filtered.length,
      live,
      phases,
      fees,
      hedgeNotional,
      totalInvested,
      netRealExclEvaluation,
      evalNetReal,
    };
  }, [filtered, trades, pairs]);

  const filtersActive =
    q.trim() !== "" || statusFilter !== "all" || fromYmd.trim() !== "" || toYmd.trim() !== "";

  function clearFilters() {
    setQ("");
    setStatusFilter("all");
    setFromYmd("");
    setToYmd("");
  }

  return (
    <div className="space-y-6">
      <ChallengeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        challengeId={null}
        defaultWorkspaceId={
          scopedWorkspaceId && scopedWorkspaceId.trim() !== ""
            ? scopedWorkspaceId
            : null
        }
        workspaceLocked={Boolean(scopedMode && scopedWorkspaceId)}
        onCreated={(id) => {
          const cc = useTradingStore.getState().getChallenge(id);
          if (cc) {
            router.push(`/identities/${cc.identityId}/challenges/${cc.id}`);
            return;
          }
          router.push(`/challenges/${id}`);
        }}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Challenges</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {scopedMode
              ? "Each row belongs to this workspace identity (prop-firm book)."
              : "Each row is one prop-firm account: challenge progress on the firm side, real money on your personal hedge. Drawdown beyond your max can fail the challenge."}
          </p>
        </div>
        <Button
          type="button"
          className="shrink-0 self-start sm:self-auto"
          onClick={() => setFormOpen(true)}
        >
          + New challenge
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-card px-6 py-14 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            {scopedMode ? "No challenges in this workspace yet." : "No challenges yet."}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            {scopedMode
              ? "Create a challenge scoped to this identity to keep payouts and audits clean."
              : "A challenge is one prop-firm evaluation or funded account."}
          </p>
          <Button type="button" onClick={() => setFormOpen(true)}>
            + New challenge
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-2 rounded-xl border border-border bg-card p-3 shadow-sm">
            <p className="text-[11px] text-muted-foreground">
              Totals reflect the filtered list below.{" "}
              <span className="font-medium text-foreground">
                Benefit excl. evaluation
              </span>{" "}
              is Σ net real for passed, funded, failed, paid out, and archived only.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <ListKpiTile
                label="Benefit excl. evaluation"
                value={formatMoney(listKpis.netRealExclEvaluation)}
                hint="Real money after fees, excluding challenges still in Evaluation."
                valueClassName={moneyTint(listKpis.netRealExclEvaluation)}
              />
              <ListKpiTile
                label="Active"
                value={String(listKpis.live)}
                hint="Evaluation, funded, or passed in the filtered set."
              />
              <ListKpiTile
                label="Total invested (est.)"
                value={formatMoney(listKpis.totalInvested)}
                hint="Sum of eval fees plus estimated personal hedge notional (|size × entry|)."
              />
              <ListKpiTile
                label="Challenges"
                value={String(listKpis.count)}
                hint="Rows matching filters."
              />
              <ListKpiTile
                label="Phases"
                value={String(listKpis.phases)}
                hint="Hedge pairs in filtered challenges."
              />
              <ListKpiTile
                label="Evaluations (book)"
                value={formatMoney(listKpis.evalNetReal)}
                hint="Net real on challenges still in Evaluation — shown separately from settled benefit."
                valueClassName={moneyTint(listKpis.evalNetReal)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Input
              id="ch-filter-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              autoComplete="off"
              className="h-8 max-w-full text-xs sm:max-w-[10rem] md:max-w-[14rem]"
              aria-label="Search challenge name"
            />
            <select
              id="ch-filter-status"
              className="h-8 max-w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs sm:max-w-[9.5rem]"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | ChallengeStatus)
              }
              aria-label="Filter by status"
            >
              {STATUS_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1.5">
              <Input
                id="ch-filter-from"
                type="date"
                value={fromYmd}
                onChange={(e) => setFromYmd(e.target.value)}
                className="h-8 w-full max-w-[10.5rem] px-2 text-xs"
                aria-label="Activity on or after"
              />
              <span className="hidden text-[10px] text-muted-foreground sm:inline">
                →
              </span>
              <Input
                id="ch-filter-to"
                type="date"
                value={toYmd}
                onChange={(e) => setToYmd(e.target.value)}
                className="h-8 w-full max-w-[10.5rem] px-2 text-xs"
                aria-label="Activity on or before"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              disabled={!filtersActive}
              onClick={clearFilters}
            >
              Clear
            </Button>
            <span className="text-[11px] tabular-nums text-muted-foreground sm:ml-auto">
              {filtered.length}/{sorted.length}
            </span>
          </div>

          {filtered.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
              No challenges match these filters.
            </p>
          ) : (
            <ul className="space-y-3">
              {filtered.map((c) => (
                <ChallengeListRow
                  key={c.id}
                  challenge={c}
                  trades={trades}
                  pairs={pairs}
                  workspaceName={
                    identityNameById.get(c.identityId)?.trim() || "Workspace"
                  }
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function ChallengeListRow({
  challenge: c,
  trades,
  pairs,
  workspaceName,
}: {
  challenge: Challenge;
  trades: LogTrade[];
  pairs: HedgePair[];
  workspaceName: string;
}) {
  const dashboard = useMemo(
    () => getChallengeDashboardMetrics(c, trades, pairs),
    [c, trades, pairs]
  );

  const phaseCount = useMemo(
    () => getPairsByChallengeId(c.id, trades, pairs).length,
    [c.id, trades, pairs]
  );

  const target = c.currentProfitTarget;
  const propR = dashboard.propRealized;
  const progressPct =
    c.status === "evaluation" && target > 0
      ? Math.min(100, (propR / target) * 100)
      : null;

  return (
    <li>
      <Link
        href={`/identities/${c.identityId}/challenges/${c.id}`}
        className="block rounded-xl border border-border bg-card px-4 py-4 shadow-sm transition-colors hover:bg-muted/30 sm:px-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-lg font-semibold tracking-tight text-foreground">
                {c.name}
              </p>
              <Badge variant="outline" className="text-[10px] font-medium">
                {workspaceName}
              </Badge>
              {statusBadge(c)}
              <span
                className="text-sm text-muted-foreground"
                title="One-time entry / eval fee for this challenge."
              >
                Fee: {formatMoney(c.fee)}
              </span>
            </div>

            {progressPct != null ? (
              <div>
                <div className="mb-1 flex justify-between text-[11px] font-medium text-muted-foreground">
                  <span
                    title="Prop firm account progress toward the profit target — not real cash."
                  >
                    Challenge progress
                  </span>
                  <span className="tabular-nums">
                    {formatMoney(propR)} / {formatMoney(target)} (
                    {Math.round(progressPct)}%)
                  </span>
                </div>
                <Progress
                  value={progressPct}
                  className="h-2 [&_[data-slot=progress-indicator]]:bg-emerald-600 dark:[&_[data-slot=progress-indicator]]:bg-emerald-500"
                />
              </div>
            ) : null}

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span
                className={moneyTint(dashboard.personalRealized)}
                title="Your real money — closed personal legs only."
              >
                <span className="text-muted-foreground">
                  Personal gains (real):{" "}
                </span>
                <span className="font-semibold tabular-nums">
                  {formatMoney(dashboard.personalRealized)}
                </span>
              </span>
              <span
                className={`font-bold tabular-nums ${moneyTint(dashboard.netReal)}`}
                title="personalRealized − challengeFee. This is what you actually made or lost on this challenge in real money."
              >
                <span className="font-normal text-muted-foreground">
                  Net real:{" "}
                </span>
                {formatMoney(dashboard.netReal)}
              </span>
              <span className="text-muted-foreground">
                Phases:{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {phaseCount}
                </span>
              </span>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-muted-foreground">
            Open
            <ChevronRight className="size-4 opacity-70" aria-hidden />
          </span>
        </div>
      </Link>
    </li>
  );
}
