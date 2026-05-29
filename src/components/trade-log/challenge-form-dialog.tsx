"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { normalizeLedgerPhases } from "@/models/trade-log/challenge-ledger";
import {
  challengeStatusLabel,
  selectableChallengeStatuses,
} from "@/models/trade-log/challenges";
import {
  dateFromCreatedAt,
  localTodayYmd,
  ymdToIsoPreserveTime,
} from "@/models/trade-log/format";
import { useTradingStore } from "@/models/trade-log/store";
import type { ChallengeStatus } from "@/models/trade-log/types";

function num(s: string, fallback = 0) {
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challengeId: string | null;
  /** Pre-select workspace for **new** challenges (identity hub route). */
  defaultWorkspaceId?: string | null;
  /** Hide workspace picker when creating from an identity hub. */
  workspaceLocked?: boolean;
  onCreated?: (id: string) => void;
};

export function ChallengeFormDialog({
  open,
  onOpenChange,
  challengeId,
  defaultWorkspaceId = null,
  workspaceLocked = false,
  onCreated,
}: Props) {
  const challenges = useTradingStore((s) => s.challenges);
  const identities = useTradingStore((s) => s.identities);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <ChallengeFormInner
          key={`${challengeId ?? "new"}-${challenges.length}-${identities.length}-${defaultWorkspaceId ?? ""}-${workspaceLocked ? "1" : "0"}`}
          challengeId={challengeId}
          defaultWorkspaceId={defaultWorkspaceId}
          workspaceLocked={workspaceLocked}
          onOpenChange={onOpenChange}
          onCreated={onCreated}
        />
      ) : null}
    </Dialog>
  );
}

function ChallengeFormInner({
  challengeId,
  defaultWorkspaceId,
  workspaceLocked,
  onOpenChange,
  onCreated,
}: {
  challengeId: string | null;
  defaultWorkspaceId?: string | null;
  workspaceLocked?: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}) {
  const challenges = useTradingStore((s) => s.challenges);
  const identities = useTradingStore((s) => s.identities);
  const addChallenge = useTradingStore((s) => s.addChallenge);
  const updateChallenge = useTradingStore((s) => s.updateChallenge);
  const existing = useMemo(
    () => (challengeId ? challenges.find((c) => c.id === challengeId) : undefined),
    [challengeId, challenges]
  );

  const sortedIdentities = useMemo(
    () =>
      [...identities].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      ),
    [identities]
  );

  const suggestedNewName = useMemo(
    () => `#${String(challenges.length + 1).padStart(4, "0")}`,
    [challenges.length]
  );

  const statusOptions = useMemo(
    () => selectableChallengeStatuses(existing?.status ?? null),
    [existing?.status]
  );

  const [name, setName] = useState(() => existing?.name ?? "");
  const [nameOverride, setNameOverride] = useState("");
  const [fee, setFee] = useState(() =>
    existing != null ? String(existing.fee) : ""
  );
  const [balance, setBalance] = useState(() =>
    existing != null ? String(existing.balance) : "0"
  );
  const [currentProfitTarget, setCurrentProfitTarget] = useState(() =>
    existing != null ? String(existing.currentProfitTarget) : "0"
  );
  const [maxDrawdown, setMaxDrawdown] = useState(() =>
    existing != null ? String(existing.maxDrawdown) : "0"
  );
  const [dailyLossCap, setDailyLossCap] = useState(() =>
    existing != null ? String(existing.dailyLossCap) : "0"
  );
  const [status, setStatus] = useState<ChallengeStatus>(
    () => existing?.status ?? "evaluation"
  );
  const [note, setNote] = useState(() => existing?.note ?? "");
  const [payoutAmountStr, setPayoutAmountStr] = useState(() =>
    existing?.payoutAmount != null && Number.isFinite(existing.payoutAmount)
      ? String(existing.payoutAmount)
      : ""
  );
  const [payoutAtStr, setPayoutAtStr] = useState(
    () => existing?.payoutAt?.trim() ?? ""
  );
  const [startedAtStr, setStartedAtStr] = useState(() =>
    existing?.createdAt ? dateFromCreatedAt(existing.createdAt) : localTodayYmd()
  );

  const [formError, setFormError] = useState<string | null>(null);

  const initialWorkspaceId = useMemo(() => {
    if (existing) return existing.identityId;
    if (
      workspaceLocked &&
      defaultWorkspaceId &&
      identities.some((i) => i.id === defaultWorkspaceId)
    ) {
      return defaultWorkspaceId;
    }
    return sortedIdentities[0]?.id ?? "";
  }, [existing, identities, workspaceLocked, defaultWorkspaceId, sortedIdentities]);

  const [workspaceId, setWorkspaceId] = useState(initialWorkspaceId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!Number.isFinite(num(fee, NaN))) {
      setFormError("Enter a valid entry fee.");
      return;
    }

    const ledgerPhases =
      existing?.ledgerPhases ?? normalizeLedgerPhases([]);

    const wf = workspaceId.trim();
    if (!wf || !identities.some((x) => x.id === wf)) {
      setFormError("Pick a workspace (identity) for this challenge.");
      return;
    }

    if (existing) {
      const patch: Parameters<typeof updateChallenge>[1] = {
        name: name.trim() || existing.name,
        fee: num(fee, 0),
        balance: num(balance, 0),
        currentProfitTarget: num(currentProfitTarget, 0),
        maxDrawdown: num(maxDrawdown, 0),
        dailyLossCap: num(dailyLossCap, 0),
        status,
        note: note.trim(),
        ledgerPhases,
        identityId: wf,
      };
      if (status === "paid_out") {
        patch.payoutAmount =
          payoutAmountStr.trim() === ""
            ? null
            : num(payoutAmountStr, 0);
        patch.payoutAt =
          payoutAtStr.trim() === "" ? null : payoutAtStr.trim();
      } else if (existing.status === "paid_out") {
        patch.payoutAmount = null;
        patch.payoutAt = null;
      }
      if (startedAtStr.trim()) {
        patch.createdAt = ymdToIsoPreserveTime(
          startedAtStr.trim(),
          existing.createdAt
        );
      }
      updateChallenge(existing.id, patch);
      onOpenChange(false);
      return;
    }

    const id = await addChallenge({
      identityId: wf,
      name: nameOverride.trim() || "",
      fee: num(fee, 0),
      balance: num(balance, 0),
      currentProfitTarget: num(currentProfitTarget, 0),
      maxDrawdown: num(maxDrawdown, 0),
      dailyLossCap: num(dailyLossCap, 0),
      status: "evaluation",
      note: note.trim(),
      payoutAmount: null,
      payoutAt: null,
      disbursementAt: null,
      ledgerPhases,
      createdAt: startedAtStr.trim()
        ? ymdToIsoPreserveTime(startedAtStr.trim())
        : undefined,
    });

    if (id == null) {
      setFormError("Could not create challenge. Check workspace and try again.");
      return;
    }

    onCreated?.(id);
    onOpenChange(false);
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <form onSubmit={onSubmit}>
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit challenge" : "New challenge"}
          </DialogTitle>
          <DialogDescription>
            Prop-firm P&amp;L drives evaluation progress; personal legs are real
            money. Your real net = personal gains minus this entry fee.
            Drawdown limits can auto-fail the challenge.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {formError ? (
            <p className="text-sm text-destructive">{formError}</p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="ch-workspace">Workspace</Label>
            {existing != null || !workspaceLocked ? (
              <>
                <Select
                  value={workspaceId !== "" ? workspaceId : undefined}
                  onValueChange={setWorkspaceId}
                >
                  <SelectTrigger id="ch-workspace">
                    <SelectValue placeholder="Select workspace" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedIdentities.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Challenges belong to exactly one trader / identity workspace.
                </p>
              </>
            ) : (
              <>
                <div className="flex min-h-10 w-full items-center rounded-md border border-input bg-muted/60 px-3 py-2 text-sm font-medium tabular-nums text-foreground">
                  {sortedIdentities.find((i) => i.id === workspaceId)?.name ||
                    workspaceId ||
                    "—"}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Challenges created here stay in this workspace.
                </p>
              </>
            )}
          </div>
          {existing ? (
            <div className="space-y-2">
              <Label htmlFor="ch-name">Name</Label>
              <Input
                id="ch-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Name (auto-assigned)</Label>
                <div className="flex min-h-10 w-full items-center rounded-md border border-input bg-muted/60 px-3 py-2 text-sm font-medium tabular-nums text-foreground">
                  {suggestedNewName}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  This is the title unless you set an override below.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ch-name-override">Override name (optional)</Label>
                <Input
                  id="ch-name-override"
                  value={nameOverride}
                  onChange={(e) => setNameOverride(e.target.value)}
                  placeholder="Custom label for this challenge"
                />
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ch-fee">Entry fee ($) — required</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  $
                </span>
                <Input
                  id="ch-fee"
                  type="number"
                  step="0.01"
                  required
                  className="pl-7"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-bal">Balance ($)</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  $
                </span>
                <Input
                  id="ch-bal"
                  type="number"
                  step="0.01"
                  className="pl-7"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ch-target">Profit target ($)</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                $
              </span>
              <Input
                id="ch-target"
                type="number"
                step="0.01"
                className="pl-7"
                value={currentProfitTarget}
                onChange={(e) => setCurrentProfitTarget(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ch-dd">Max drawdown ($)</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  $
                </span>
                <Input
                  id="ch-dd"
                  type="number"
                  step="0.01"
                  className="pl-7"
                  value={maxDrawdown}
                  onChange={(e) => setMaxDrawdown(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-dlc">Daily loss cap ($)</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  $
                </span>
                <Input
                  id="ch-dlc"
                  type="number"
                  step="0.01"
                  className="pl-7"
                  value={dailyLossCap}
                  onChange={(e) => setDailyLossCap(e.target.value)}
                />
              </div>
            </div>
          </div>

          {existing ? (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as ChallengeStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((st) => (
                    <SelectItem key={st} value={st}>
                      {challengeStatusLabel(st)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Status: <span className="font-medium text-foreground">Evaluation</span>{" "}
              (new challenges always start here)
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="ch-started">Started date</Label>
            <Input
              id="ch-started"
              type="date"
              value={startedAtStr}
              onChange={(e) => setStartedAtStr(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              When this challenge began in your journal (used for sorting and KPIs).
            </p>
          </div>

          {existing && status === "paid_out" ? (
            <div className="grid gap-3 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground">
                Payout recorded
              </p>
              <div className="space-y-2">
                <Label htmlFor="ch-payout-amt">Payout amount ($)</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="ch-payout-amt"
                    type="number"
                    step="0.01"
                    className="pl-7"
                    value={payoutAmountStr}
                    onChange={(e) => setPayoutAmountStr(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ch-payout-at">Payout date</Label>
                <Input
                  id="ch-payout-at"
                  type="date"
                  value={
                    payoutAtStr.length >= 10
                      ? payoutAtStr.slice(0, 10)
                      : payoutAtStr
                  }
                  onChange={(e) => setPayoutAtStr(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="ch-note">Note (optional)</Label>
            <Textarea
              id="ch-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
