"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { ChallengeFormDialog } from "@/components/trade-log/challenge-form-dialog";
import { WorkspaceSelector } from "@/components/trade-log/workspace-selector";
import { ChallengesOverview } from "@/components/trade-log/challenges-overview-redesign";
import { ChallengeRowRedesign } from "@/components/trade-log/challenge-row-redesign";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  challengeMatchesActivityDateRange,
  challengeStatusLabel,
} from "@/models/trade-log/challenges";
import { formatMoney, formatShortMonthDay } from "@/models/trade-log/format";
import { useTradingStore } from "@/models/trade-log/store";
import type { Challenge, ChallengeStatus, HedgePair, LogTrade } from "@/models/trade-log/types";

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
];


export function ChallengesIndexPage({
  scopedWorkspaceId = null,
  scopedMode = false,
  integratedMode = false,
}: {
  scopedWorkspaceId?: string | null;
  scopedMode?: boolean;
  integratedMode?: boolean;
} = {}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ChallengeStatus>("all");
  const [fromYmd, setFromYmd] = useState("");
  const [toYmd, setToYmd] = useState("");
  
  // Get activeIdentityId from store for integrated mode
  const activeIdentityId = useTradingStore((s) => s.activeIdentityId);
  const setActiveIdentityId = useTradingStore((s) => s.setActiveIdentityId);
  
  // For integrated mode, we manage workspace selection internally and sync with store
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    integratedMode ? activeIdentityId : scopedWorkspaceId
  );
  
  // Handle workspace change for integrated mode
  const handleWorkspaceChange = (workspaceId: string | null) => {
    if (integratedMode) {
      setSelectedWorkspaceId(workspaceId);
      setActiveIdentityId(workspaceId);
    }
  };
  
  // Use selectedWorkspaceId for integrated mode, or scopedWorkspaceId for legacy mode
  const effectiveWorkspaceId = integratedMode ? selectedWorkspaceId : scopedWorkspaceId;

  const { challenges: allChallenges, trades, pairs, identities } = useTradingStore(
    useShallow((s) => ({
      challenges: s.challenges,
      trades: s.trades,
      pairs: s.pairs,
      identities: s.identities,
    }))
  );

  const challenges = useMemo(() => {
    if (effectiveWorkspaceId == null || effectiveWorkspaceId.trim() === "") {
      return allChallenges;
    }
    return allChallenges.filter((c) => c.identityId === effectiveWorkspaceId);
  }, [allChallenges, effectiveWorkspaceId]);

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


  const filtersActive =
    q.trim() !== "" || statusFilter !== "all" || fromYmd.trim() !== "" || toYmd.trim() !== "";

  function clearFilters() {
    setQ("");
    setStatusFilter("all");
    setFromYmd("");
    setToYmd("");
  }

  return (
    <div className="space-y-4">
      {integratedMode && (
        <header className="border-b border-border/40 pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Challenges</h1>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Prop firm evaluations &amp; funded accounts
                </p>
              </div>
              <ChallengesOverview selectedWorkspaceId={selectedWorkspaceId} />
            </div>
            <div className="flex shrink-0 items-center gap-2 lg:pb-0.5">
              <WorkspaceSelector
                selectedWorkspaceId={selectedWorkspaceId}
                onWorkspaceChange={handleWorkspaceChange}
                showAllOption={true}
              />
              <Button size="sm" onClick={() => setFormOpen(true)}>
                + New
              </Button>
            </div>
          </div>
        </header>
      )}

      <ChallengeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        challengeId={null}
        defaultWorkspaceId={
          effectiveWorkspaceId && effectiveWorkspaceId.trim() !== ""
            ? effectiveWorkspaceId
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

      {/* Legacy header for scoped mode and global challenges page */}
      {!integratedMode && (
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
      )}

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-card px-6 py-14 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            {integratedMode 
              ? (selectedWorkspaceId ? "No challenges in this workspace yet." : "No challenges yet.")
              : (scopedMode ? "No challenges in this workspace yet." : "No challenges yet.")}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            {integratedMode
              ? "Create a challenge to start tracking your prop firm evaluations and funded accounts."
              : (scopedMode
                ? "Create a challenge scoped to this identity to keep payouts and audits clean."
                : "A challenge is one prop-firm evaluation or funded account.")}
          </p>
          <Button type="button" onClick={() => setFormOpen(true)}>
            + New challenge
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center">
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
            <div className="space-y-1.5">
              {filtered.map((c) => (
                <ChallengeRowRedesign
                  key={c.id}
                  challenge={c}
                  trades={trades}
                  pairs={pairs}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

