"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { AddHedgePairDialog } from "@/components/trade-log/add-hedge-pair-dialog";
import { ChallengeFormDialog } from "@/components/trade-log/challenge-form-dialog";
import { ChallengeHedgePairsTable } from "@/components/trade-log/challenge-hedge-pairs-table";
import { ChallengePhasePlanner } from "@/components/trade-log/challenge-phase-planner";
import { PhasePlanCard } from "@/components/trade-log/phase-plan-card";
import { EditPlanDialog } from "@/components/trade-log/edit-plan-dialog";
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
import { computeHedgeResults } from "@/models/trade-log/hedge-planner";
import { useTradingStore } from "@/models/trade-log/store";
import type { Challenge, ChallengeStatus, PhasePlan } from "@/models/trade-log/types";
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
    plans,
    addTrade,
    linkPair,
    updateTrade,
    updateChallenge,
    deleteHedgePairCascade,
    deleteChallengeCascade,
    addPlan,
    updatePlan,
    deletePlan,
    linkPlanToHedgePair,
  } = useTradingStore(
    useShallow((s) => ({
      challenges: s.challenges,
      trades: s.trades,
      pairs: s.pairs,
      identities: s.identities,
      plans: s.plans,
      addTrade: s.addTrade,
      linkPair: s.linkPair,
      updateTrade: s.updateTrade,
      updateChallenge: s.updateChallenge,
      deleteHedgePairCascade: s.deleteHedgePairCascade,
      deleteChallengeCascade: s.deleteChallengeCascade,
      addPlan: s.addPlan,
      updatePlan: s.updatePlan,
      deletePlan: s.deletePlan,
      linkPlanToHedgePair: s.linkPlanToHedgePair,
    }))
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddNonce, setQuickAddNonce] = useState(0);
  const [prefillData, setPrefillData] = useState<any>(null);
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
  
  // Plan editing state
  const [editPlanOpen, setEditPlanOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PhasePlan | null>(null);
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

  const challengePlans = useMemo(
    () =>
      plans
        .filter((p) => p.challengeId === challengeId)
        .sort((a, b) =>
          a.phaseNumber !== b.phaseNumber
            ? a.phaseNumber - b.phaseNumber
            : a.createdAt.localeCompare(b.createdAt)
        ),
    [plans, challengeId]
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
        onOpenChange={(open) => {
          setQuickAddOpen(open);
          if (!open) {
            setPrefillData(null);
          }
        }}
        formKey={quickAddNonce}
        challengeId={c.id}
        challengeName={c.name}
        locked={propTradesLocked}
        prefill={prefillData}
        addTrade={addTrade}
        linkPair={linkPair}
      />

      <EditPlanDialog
        open={editPlanOpen}
        plan={editingPlan}
        onOpenChange={setEditPlanOpen}
        onSave={(planId, updates) => {
          updatePlan(planId, updates);
          setFeedback("Plan updated successfully.");
          setEditingPlan(null);
        }}
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

      {/* Compact Sticky Header */}
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">{c.name}</h1>
            {statusBadgeSpec(c)}
            <span className="text-sm text-muted-foreground">Fee: {formatMoney(c.fee)}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Your net</div>
              <div className="text-lg font-semibold">{formatMoney(realTotal)}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  setPrefillData(null);
                  setQuickAddNonce((n) => n + 1);
                  setQuickAddOpen(true);
                }}
                disabled={propTradesLocked}
              >
                Log Trade
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setDialogOpen(true)}
              >
                Edit
              </Button>
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
          </div>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 px-6 py-4">
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

      {/* Main Planner */}
      <div className="px-6 py-8">
        <ChallengePhasePlanner
          challenge={c}
          plans={challengePlans}
          onSavePlan={(planData) => {
            const planId = addPlan(planData);
            if (planId) {
              setFeedback("Plan saved successfully.");
            }
          }}
          onOpenLogDialog={(prefill) => {
            setPrefillData(prefill);
            setQuickAddNonce((n) => n + 1);
            setQuickAddOpen(true);
          }}
        />
      </div>

      {/* Quiet Secondary Content */}
      <div className="border-t border-border bg-muted/10 px-6 py-6">
        {/* Saved Plans */}
        {challengePlans.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Saved Plans</h3>
            <div className="space-y-2">
              {challengePlans.map(plan => {
                const linkedPair = pairs.find(p => p.planId === plan.id);
                return (
                  <PhasePlanCard
                    key={plan.id}
                    plan={plan}
                    linkedPairExists={linkedPair != null}
                    onEdit={(plan) => {
                      setEditingPlan(plan);
                      setEditPlanOpen(true);
                    }}
                    onDelete={(planId) => {
                      const ok = window.confirm("Delete this plan?");
                      if (ok) {
                        deletePlan(planId);
                        setFeedback("Plan deleted.");
                      }
                    }}
                    onExecute={(plan) => {
                      // Calculate results to get full trade details
                      const challenge = challenges.find(c => c.id === plan.challengeId);
                      if (!challenge) return;
                      
                      try {
                        const hedgeInput = {
                          propTpUsd: plan.propTpUsd,
                          propSlUsd: plan.propSlUsd,
                          propContracts: plan.propContracts,
                          personalTargetProfit: plan.personalTargetProfit,
                          personalPointValue: plan.personalPointValue,
                          buffer: plan.buffer,
                          lotStep: plan.lotStep,
                          minLot: plan.minLot,
                          challengeFee: challenge.fee,
                          expectedPayout: plan.expectedPayout
                        };
                        
                        const results = computeHedgeResults(hedgeInput);
                        
                        // Calculate personal win/loss amounts for context
                        const personalWinUsd = results.personalTpPoints * results.roundedLots * plan.personalPointValue;
                        const personalLossUsd = results.personalSlPoints * results.roundedLots * plan.personalPointValue;
                        
                        // Calculate reasonable entry price from USD amounts and points
                        const estimatedEntryPrice = results.propDirection === "long" 
                          ? results.propTpUsd / plan.propContracts / 20 - results.propTpPoints
                          : results.propTpUsd / plan.propContracts / 20 + results.propTpPoints;

                        // Complete prefill data matching live planner
                        setPrefillData({
                          // Basic trade info
                          symbol: "ES",
                          direction: results.personalDirection,
                          size: results.roundedLots,
                          
                          // Calculated entry price for price calculations
                          entryPrice: Math.round(estimatedEntryPrice * 100) / 100, // Round to 2 decimals
                          
                          // Expected amounts for validation
                          personalPnl: personalWinUsd,
                          propPnl: results.propTpUsd, // Expected prop side profit
                          
                          // Additional hedge context
                          propContracts: plan.propContracts,
                          propDirection: results.propDirection,
                          propTpUsd: results.propTpUsd,
                          propSlUsd: results.propSlUsd,
                          propTpPoints: results.propTpPoints,
                          propSlPoints: results.propSlPoints,
                          personalTpPoints: results.personalTpPoints,
                          personalSlPoints: results.personalSlPoints,
                          hedgeTarget: plan.personalTargetProfit,
                          buffer: plan.buffer,
                          personalLossUsd: personalLossUsd,
                          hedgePlanId: plan.id, // Link to the executed plan
                        });
                      } catch (error) {
                        console.error("Error calculating plan for prefill:", error);
                        // Fallback to basic prefill
                        const direction = plan.propTpUsd > plan.propSlUsd ? "long" : "short";
                        setPrefillData({
                          symbol: plan.propSymbol,
                          direction: direction,
                        });
                      }
                      
                      setQuickAddNonce((n) => n + 1);
                      setQuickAddOpen(true);
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        
        {/* Phases Table */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Phase History</h3>
          <ChallengeHedgePairsTable
            pairs={challengePairs}
            trades={trades}
            challengeId={c.id}
            updateTrade={updateTrade}
            deleteHedgePairCascade={deleteHedgePairCascade}
            unlinkDisabled={propTradesLocked}
            onRequestLogPhase={() => {
              setPrefillData(null);
              setQuickAddNonce((n) => n + 1);
              setQuickAddOpen(true);
            }}
          />
        </div>
      </div>
    </div>
  );
}
