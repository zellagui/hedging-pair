"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { AddHedgePairDialog } from "@/components/trade-log/add-hedge-pair-dialog";
import { ChallengeFormDialog } from "@/components/trade-log/challenge-form-dialog";
import { ChallengeHedgePairsTable } from "@/components/trade-log/challenge-hedge-pairs-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CHALLENGE_STATUS_TRANSITIONS,
  challengeAcceptsNewPropTrades,
  challengeStatusLabel,
  countOpenLegsForChallenge,
  estimatePersonalNotionalForChallenge,
  getChallengeDashboardMetrics,
  getPairsByChallengeId,
} from "@/models/trade-log/challenges";
import { formatMoney, formatShortMonthDay, localTodayYmd } from "@/models/trade-log/format";
import { useTradingStore } from "@/models/trade-log/store";
import type { Challenge, ChallengeStatus } from "@/models/trade-log/types";
import { cn } from "@/lib/utils";

const QUICK_STATUS_ORDER: ChallengeStatus[] = [
  "passed",
  "funded",
  "failed",
  "archived",
  "paid_out",
];

function quickStatusRank(s: ChallengeStatus): number {
  if (s === "evaluation") return -1;
  const i = QUICK_STATUS_ORDER.indexOf(s);
  return i >= 0 ? i : 99;
}

function nextQuickStatuses(current: ChallengeStatus): ChallengeStatus[] {
  const raw = CHALLENGE_STATUS_TRANSITIONS[current].filter((s) => s !== current);
  const skipPaidOut = current === "funded" || current === "passed";
  const filtered = raw.filter((s) => !(skipPaidOut && s === "paid_out"));
  return [...filtered].sort(
    (a, b) => quickStatusRank(a) - quickStatusRank(b)
  );
}

function quickStatusShortLabel(s: ChallengeStatus): string {
  switch (s) {
    case "evaluation":
      return "Evaluation";
    case "passed":
      return "Passed";
    case "funded":
      return "Funded";
    case "failed":
      return "Failed";
    case "archived":
      return "Archive";
    default:
      return challengeStatusLabel(s);
  }
}

function statusBadgeSpec(challenge: Challenge) {
  const label =
    challenge.status === "paid_out"
      ? "Paid out"
      : challengeStatusLabel(challenge.status);
  const { status } = challenge;
  const emoji =
    status === "evaluation"
      ? "🔵"
      : status === "funded"
        ? "🟢"
        : status === "passed"
          ? "🟢"
          : status === "failed"
            ? "🔴"
            : status === "paid_out"
              ? "💜"
              : status === "archived"
                ? "🗄"
                : "⚪";

  const cls = cn(
    "border-0 font-medium shadow-none",
    status === "evaluation" &&
      "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200",
    status === "funded" &&
      "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200",
    status === "passed" &&
      "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200",
    status === "failed" &&
      "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200",
    status === "paid_out" &&
      "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
    status === "archived" &&
      "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
  );

  return (
    <Badge className={cls}>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden>{emoji}</span>
        <span>{label}</span>
      </span>
    </Badge>
  );
}

function DetailKpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div
      className="rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm"
      title={hint}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

function ChallengeNotFound() {
  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Challenge not found</CardTitle>
        <p className="text-sm text-muted-foreground">
          No challenge with this id exists in your browser journal.
        </p>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button asChild variant="default" size="sm">
          <Link href="/identities">Workspaces</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/challenges">All challenges</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/">Overview</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

type Props = {
  challengeId: string;
  /** When present, redirects to canonical URL if mismatch (nested route guard). */
  expectedWorkspaceId?: string | null;
};

export function ChallengeDetailClient({
  challengeId,
  expectedWorkspaceId = null,
}: Props) {
  const router = useRouter();
  const {
    challenges,
    trades,
    pairs,
    identities,
    addTrade,
    linkPair,
    updateTrade,
    updateChallenge,
    deleteHedgePairCascade,
    deleteChallengeCascade,
  } = useTradingStore(
    useShallow((s) => ({
      challenges: s.challenges,
      trades: s.trades,
      pairs: s.pairs,
      identities: s.identities,
      addTrade: s.addTrade,
      linkPair: s.linkPair,
      updateTrade: s.updateTrade,
      updateChallenge: s.updateChallenge,
      deleteHedgePairCascade: s.deleteHedgePairCascade,
      deleteChallengeCascade: s.deleteChallengeCascade,
    }))
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddNonce, setQuickAddNonce] = useState(0);
  const [deleteChallengeOpen, setDeleteChallengeOpen] = useState(false);
  const [deleteChallengeConfirm, setDeleteChallengeConfirm] = useState("");
  const [deleteChallengeError, setDeleteChallengeError] = useState<
    string | null
  >(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [payoutExpanded, setPayoutExpanded] = useState(false);
  const [payoutAmountStr, setPayoutAmountStr] = useState("");
  const [payoutDateStr, setPayoutDateStr] = useState(() => localTodayYmd());
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const statusMenuRef = useRef<HTMLDetailsElement>(null);

  const challenge = useMemo(
    () => challenges.find((c) => c.id === challengeId),
    [challenges, challengeId]
  );

  const dashboard = useMemo(() => {
    if (!challenge) return null;
    return getChallengeDashboardMetrics(challenge, trades, pairs);
  }, [challenge, trades, pairs]);

  const challengePairs = useMemo(
    () =>
      [...getPairsByChallengeId(challengeId, trades, pairs)].sort((a, b) =>
        a.phaseNumber !== b.phaseNumber
          ? a.phaseNumber - b.phaseNumber
          : a.createdAt.localeCompare(b.createdAt)
      ),
    [challengeId, trades, pairs]
  );

  useEffect(() => {
    if (!challenge) return;
    if (expectedWorkspaceId == null || expectedWorkspaceId.trim() === "") return;
    if (challenge.identityId !== expectedWorkspaceId.trim()) {
      router.replace(
        `/identities/${challenge.identityId}/challenges/${challenge.id}`
      );
    }
  }, [challenge, expectedWorkspaceId, challengeId, router]);

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 2600);
    return () => window.clearTimeout(t);
  }, [feedback]);

  if (!challenge || !dashboard) {
    return <ChallengeNotFound />;
  }

  const c = challenge;
  const dash = dashboard;

  const propTradesLocked = !challengeAcceptsNewPropTrades(c);

  const rulesUnset =
    c.currentProfitTarget <= 0 &&
    c.maxDrawdown <= 0 &&
    c.dailyLossCap <= 0;

  const deleteChallengeNameOk =
    deleteChallengeConfirm.trim().length > 0 &&
    deleteChallengeConfirm.trim() === c.name.trim();

  const openLegs = countOpenLegsForChallenge(c.id, trades, pairs);
  const hedgeNotionalEst = estimatePersonalNotionalForChallenge(
    c.id,
    trades,
    pairs
  );
  const realTotal = dash.personalRealized - c.fee;
  const personalLive = dash.personalRunning;
  const personalClosed = dash.personalRealized;
  const hedgeDiffers =
    openLegs > 0 &&
    Math.abs(personalLive - personalClosed) > 0.005;
  const quickNext = nextQuickStatuses(c.status);
  const canLogPayout = c.status === "funded" || c.status === "passed";
  const workspaceLabel =
    identities.find((i) => i.id === c.identityId)?.name ?? "Workspace";

  function num(s: string, fallback = 0) {
    const n = Number(s);
    return Number.isFinite(n) ? n : fallback;
  }

  function applyQuickStatus(next: ChallengeStatus) {
    if (next === "failed" || next === "archived") {
      const ok = window.confirm(
        next === "failed"
          ? "Mark this challenge as failed? This indicates the prop evaluation or account failed."
          : "Archive this challenge? You can still view it from the list if kept."
      );
      if (!ok) return;
    }
    updateChallenge(c.id, { status: next });
    setFeedback(`${challengeStatusLabel(next)}.`);
  }

  function savePayout() {
    setPayoutError(null);
    const amt = num(payoutAmountStr, NaN);
    if (!Number.isFinite(amt)) {
      setPayoutError("Enter a valid payout amount.");
      return;
    }
    const date = payoutDateStr.trim() || localTodayYmd();
    updateChallenge(c.id, {
      payoutAmount: amt,
      payoutAt: date,
      status: "paid_out",
    });
    setFeedback("Payout logged. Challenge marked as paid out.");
    setPayoutAmountStr("");
    setPayoutExpanded(false);
  }

  return (
    <div className="my-6 space-y-5">
      <AlertDialog
        open={deleteChallengeOpen}
        onOpenChange={(open) => {
          setDeleteChallengeOpen(open);
          if (!open) {
            setDeleteChallengeConfirm("");
            setDeleteChallengeError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this challenge?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  This removes the challenge, <strong>all phases</strong>, and{" "}
                  <strong>all related trades</strong>. This cannot be undone.
                </p>
                <p>
                  Type the challenge name{" "}
                  <span className="font-semibold text-foreground">
                    {c.name}
                  </span>{" "}
                  to confirm.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteChallengeError ? (
            <p className="text-sm text-destructive">{deleteChallengeError}</p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="delete-challenge-confirm">Challenge name</Label>
            <Input
              id="delete-challenge-confirm"
              autoComplete="off"
              value={deleteChallengeConfirm}
              onChange={(e) => setDeleteChallengeConfirm(e.target.value)}
              placeholder={c.name}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={!deleteChallengeNameOk}
              onClick={(e) => {
                e.preventDefault();
                setDeleteChallengeError(null);
                if (!deleteChallengeNameOk) return;
                const ok = deleteChallengeCascade(c.id);
                if (!ok) {
                  setDeleteChallengeError(
                    "Cannot delete: a trade is linked to a closed session."
                  );
                  return;
                }
                setDeleteChallengeOpen(false);
                setDeleteChallengeConfirm("");
                router.push(`/identities/${c.identityId}`);
              }}
            >
              Delete challenge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ChallengeFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        challengeId={c.id}
      />

      <AddHedgePairDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        formKey={quickAddNonce}
        challengeId={c.id}
        challengeName={c.name}
        locked={propTradesLocked}
        addTrade={addTrade}
        linkPair={linkPair}
      />

      {propTradesLocked ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-50">
          <p className="font-medium text-foreground">
            This challenge is closed to new phases in the journal.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="font-semibold tracking-tight text-foreground">
          Trading journal
        </span>
        <span className="text-border" aria-hidden>
          ·
        </span>
        <Link href="/" className="hover:text-foreground">
          Overview
        </Link>
        <span aria-hidden>·</span>
        <Link href="/identities" className="hover:text-foreground">
          Workspaces
        </Link>
        <span aria-hidden>·</span>
        <Link
          href={`/identities/${c.identityId}`}
          className="truncate hover:text-foreground"
        >
          {workspaceLabel}
        </Link>
        <span aria-hidden>·</span>
        <span className="truncate text-muted-foreground/80">{c.name}</span>
      </div>

      <Link
        href={`/identities/${c.identityId}`}
        className="-mt-2 inline-flex text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        ← {workspaceLabel}
      </Link>

      {/* Zone 1 — Sticky header + single money summary */}
      <div
        className={cn(
          "sticky top-0 z-20 rounded-xl border border-border bg-background/95 p-4 shadow-sm backdrop-blur-md",
          "supports-[backdrop-filter]:bg-background/80"
        )}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight break-words wrap-break-word">
              {c.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {statusBadgeSpec(c)}
              <span className="text-sm tabular-nums text-red-500">
                Fee {formatMoney(-c.fee)}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-sm text-muted-foreground">
                {challengePairs.length} phase{challengePairs.length === 1 ? "" : "s"}
                {openLegs > 0 ? ` · ${openLegs} open` : ""}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={propTradesLocked}
                title={
                  propTradesLocked
                    ? "This challenge does not accept new trades."
                    : undefined
                }
                onClick={() => {
                  setQuickAddNonce((n) => n + 1);
                  setQuickAddOpen(true);
                }}
              >
                Log phase
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setDialogOpen(true)}
              >
                Edit
              </Button>
              {canLogPayout ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPayoutExpanded((v) => !v);
                    setPayoutError(null);
                  }}
                >
                  Log payout
                </Button>
              ) : null}
              {quickNext.length > 0 ? (
                <details ref={statusMenuRef} className="relative">
                  <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground [&::-webkit-details-marker]:hidden">
                    Status
                    <ChevronDown className="size-3.5 opacity-70" />
                  </summary>
                  <div className="absolute right-0 z-30 mt-1 flex min-w-[11rem] flex-col gap-1 rounded-md border border-border bg-popover p-1.5 shadow-md">
                    {quickNext.map((st) => (
                      <Button
                        key={st}
                        type="button"
                        size="sm"
                        variant={st === "failed" ? "destructive" : "ghost"}
                        className="h-8 justify-start font-normal"
                        onClick={() => {
                          applyQuickStatus(st);
                          statusMenuRef.current?.removeAttribute("open");
                        }}
                      >
                        {quickStatusShortLabel(st)}
                      </Button>
                    ))}
                  </div>
                </details>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  setDeleteChallengeError(null);
                  setDeleteChallengeConfirm("");
                  setDeleteChallengeOpen(true);
                }}
              >
                Delete
              </Button>
            </div>

            {canLogPayout && payoutExpanded ? (
              <div className="w-full max-w-md rounded-md border border-border bg-muted/30 p-3 text-left sm:ml-auto">
                <p className="mb-2 text-xs text-muted-foreground">
                  Records firm payout and marks challenge paid out.
                </p>
                <div className="flex flex-wrap gap-2">
                  <div className="relative min-w-[100px] flex-1">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 pl-7"
                      placeholder="Amount"
                      value={payoutAmountStr}
                      onChange={(e) => setPayoutAmountStr(e.target.value)}
                    />
                  </div>
                  <Input
                    type="date"
                    className="h-8 w-[140px]"
                    value={
                      payoutDateStr.length >= 10
                        ? payoutDateStr.slice(0, 10)
                        : payoutDateStr
                    }
                    onChange={(e) => setPayoutDateStr(e.target.value)}
                  />
                </div>
                {payoutError ? (
                  <p className="mt-1 text-xs text-destructive">{payoutError}</p>
                ) : null}
                <div className="mt-2 flex gap-2">
                  <Button type="button" size="sm" onClick={savePayout}>
                    Save payout
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setPayoutExpanded(false);
                      setPayoutError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div
          className={cn(
            "mt-4 rounded-lg border px-4 py-3",
            realTotal >= 0 ? "border-green-500/25 bg-green-500/[0.06]" : "border-red-500/25 bg-red-500/[0.06]"
          )}
          title="Personal realized minus entry fee."
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Your net
          </p>
          <p
            className={cn(
              "mt-0.5 text-3xl font-bold tabular-nums tracking-tight",
              realTotal > 0 && "text-green-500",
              realTotal < 0 && "text-red-500",
              realTotal === 0 && "text-muted-foreground"
            )}
          >
            {formatMoney(realTotal)}
          </p>
          <p
            className={cn(
              "mt-2 text-sm tabular-nums",
              personalLive > 0 && "text-green-600 dark:text-green-400",
              personalLive < 0 && "text-red-600 dark:text-red-400",
              personalLive === 0 && "text-muted-foreground"
            )}
          >
            Personal hedge {formatMoney(personalLive)}
            {hedgeDiffers ? (
              <span className="font-normal text-muted-foreground">
                {" "}
                (closed {formatMoney(personalClosed)})
              </span>
            ) : null}
          </p>
        </div>

        {feedback ? (
          <p className="mt-3 rounded-md border border-green-500/35 bg-green-500/10 px-3 py-2 text-sm text-green-800 dark:text-green-100">
            {feedback}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <DetailKpi label="Phases (total)" value={String(challengePairs.length)} />
        <DetailKpi
          label="Open legs (live)"
          value={String(openLegs)}
          hint="Prop + personal legs not yet closed in the journal."
        />
        <DetailKpi
          label="Est. in hedge"
          value={formatMoney(hedgeNotionalEst)}
          hint="Rough |size × entry| on personal legs — display only."
        />
        <DetailKpi
          label="Combined realized"
          value={formatMoney(dash.combinedRealized)}
          hint="Closed prop + closed personal legs for this challenge."
        />
        <DetailKpi
          label="Started"
          value={formatShortMonthDay(c.createdAt)}
          hint="Challenge created in journal."
        />
      </div>

      {/* Zone 2 — Rules strip */}
      <details className="group rounded-lg border border-border bg-muted/20">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden>ℹ</span>
            Firm / eval reference
            <span className="text-muted-foreground group-open:hidden">▼</span>
            <span className="hidden text-muted-foreground group-open:inline">▲</span>
          </span>
        </summary>
        <div className="border-t border-border px-4 py-3 text-sm">
          {rulesUnset ? (
            <p className="mb-3 text-xs text-muted-foreground">
              Optional: add evaluation rules in Edit if you want them on record
              (target, drawdown, daily cap).
            </p>
          ) : null}
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-red-500">Fee: {formatMoney(-c.fee)}</span>
            <span>Balance: {formatMoney(c.balance)}</span>
            <span>Target: {formatMoney(c.currentProfitTarget)}</span>
          </p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <span>Max DD: {formatMoney(c.maxDrawdown)}</span>
            <span>Daily cap: {formatMoney(c.dailyLossCap)}</span>
          </p>
          {c.note.trim() ? (
            <p className="mt-3 text-muted-foreground">
              <span className="font-medium text-foreground">Note: </span>
              {c.note.trim()}
            </p>
          ) : null}
        </div>
      </details>

      {/* Zone 3 — Phases */}
      <Card className="border-border shadow-sm">
        <CardHeader className="border-b border-border py-4">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Phases
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <ChallengeHedgePairsTable
            pairs={challengePairs}
            trades={trades}
            challengeId={c.id}
            updateTrade={updateTrade}
            deleteHedgePairCascade={deleteHedgePairCascade}
            unlinkDisabled={propTradesLocked}
            onRequestLogPhase={() => {
              setQuickAddNonce((n) => n + 1);
              setQuickAddOpen(true);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
