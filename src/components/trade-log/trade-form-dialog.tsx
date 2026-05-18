"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  challengeAcceptsNewPropTrades,
} from "@/models/trade-log/challenges";
import { formatMoney } from "@/models/trade-log/format";
import {
  computeRealizedPnl,
  computeUnrealizedPnl,
} from "@/models/trade-log/pnl";
import type { LogSession, LogTrade, TradeDirection } from "@/models/trade-log/types";
import { useTradingStore } from "@/models/trade-log/store";

function num(s: string, fallback = 0) {
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function numOrEmpty(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function emptyOrStr(n: number | null) {
  return n == null ? "" : String(n);
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tradeId: string | null;
};

export function TradeFormDialog({ open, onOpenChange, tradeId }: Props) {
  const identities = useTradingStore((s) => s.identities);
  const activeIdentityId = useTradingStore((s) => s.activeIdentityId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <TradeFormInner
          key={`${tradeId ?? "new"}-${identities.length}-${activeIdentityId ?? ""}`}
          tradeId={tradeId}
          onOpenChange={onOpenChange}
        />
      ) : null}
    </Dialog>
  );
}

function TradeFormInner({
  tradeId,
  onOpenChange,
}: {
  tradeId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const sessions = useTradingStore((s) => s.sessions);
  const challenges = useTradingStore((s) => s.challenges);
  const identities = useTradingStore((s) => s.identities);
  const activeIdentityId = useTradingStore((s) => s.activeIdentityId);
  const addSession = useTradingStore((s) => s.addSession);
  const addTrade = useTradingStore((s) => s.addTrade);
  const updateTrade = useTradingStore((s) => s.updateTrade);
  const existing = useTradingStore((s) =>
    tradeId ? s.getTrade(tradeId) : undefined
  );

  const readOnlySession =
    existing?.sessionId != null &&
    sessions.find((x) => x.id === existing.sessionId)?.closed === true;

  const [createSession, setCreateSession] = useState(false);
  const [newSessionDate, setNewSessionDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [newSessionNotes, setNewSessionNotes] = useState("");

  const [sessionId, setSessionId] = useState<string | "__none__">(() => {
    const sid = existing?.sessionId;
    return sid && sid !== "" ? sid : "__none__";
  });
  const [side, setSide] = useState<"prop" | "personal">(() =>
    existing?.challengeId != null ? "prop" : "personal"
  );
  const [challengeId, setChallengeId] = useState<string>(() =>
    existing?.challengeId ?? ""
  );
  const [symbol, setSymbol] = useState(() => existing?.symbol ?? "");
  const [direction, setDirection] = useState<TradeDirection>(
    () => existing?.direction ?? "long"
  );
  const [size, setSize] = useState(() =>
    existing ? String(existing.size) : "1"
  );
  const [entryPrice, setEntryPrice] = useState(() =>
    existing ? String(existing.entryPrice) : ""
  );
  const [exitPrice, setExitPrice] = useState(() =>
    existing ? emptyOrStr(existing.exitPrice) : ""
  );
  const [currentPrice, setCurrentPrice] = useState(() =>
    existing ? emptyOrStr(existing.currentPrice) : ""
  );
  const [stopLoss, setStopLoss] = useState(() =>
    existing ? emptyOrStr(existing.stopLoss) : ""
  );
  const [takeProfit, setTakeProfit] = useState(() =>
    existing ? emptyOrStr(existing.takeProfit) : ""
  );
  const [fees, setFees] = useState(() =>
    existing ? String(existing.fees) : "0"
  );
  const [notes, setNotes] = useState(() => existing?.notes ?? "");
  const [screenshot, setScreenshot] = useState(
    () => existing?.screenshot ?? ""
  );
  const [formError, setFormError] = useState<string | null>(null);

  const defaultTradeIdentityId = useMemo(() => {
    if (existing) {
      return existing.challengeId != null ? "" : existing.identityId;
    }
    const sorted = [...identities].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
    const first = sorted[0]?.id ?? "";
    const activeOk =
      activeIdentityId &&
      identities.some((i) => i.id === activeIdentityId)
        ? activeIdentityId
        : "";
    return activeOk || first;
  }, [existing, identities, activeIdentityId]);

  const [tradeIdentityId, setTradeIdentityId] = useState(
    defaultTradeIdentityId
  );

  const resolvedChallengeId =
    side === "prop" && challengeId.trim() !== "" ? challengeId : null;

  const resolvedPropChallenge = useMemo(
    () =>
      resolvedChallengeId
        ? challenges.find((x) => x.id === resolvedChallengeId)
        : undefined,
    [resolvedChallengeId, challenges]
  );

  const previewDraft = useMemo((): LogTrade | null => {
    const e = numOrEmpty(exitPrice);
    const c = numOrEmpty(currentPrice);
    return {
      id: "preview",
      identityId:
        resolvedChallengeId != null
          ? (resolvedPropChallenge?.identityId.trim() || "preview")
          : (tradeIdentityId.trim() || "preview"),
      challengeId: resolvedChallengeId,
      sessionId: null,
      symbol: symbol || "X",
      direction,
      size: num(size, 1),
      entryPrice: num(entryPrice, 0),
      exitPrice: e,
      directPnl: null,
      currentPrice: e != null ? null : c,
      stopLoss: numOrEmpty(stopLoss),
      takeProfit: numOrEmpty(takeProfit),
      fees: num(fees, 0),
      notes: "",
      screenshot: null,
      createdAt: "",
      updatedAt: "",
    };
  }, [
    resolvedChallengeId,
    resolvedPropChallenge?.identityId,
    tradeIdentityId,
    symbol,
    direction,
    size,
    entryPrice,
    exitPrice,
    currentPrice,
    stopLoss,
    takeProfit,
    fees,
  ]);

  const previewText =
    previewDraft &&
    (previewDraft.exitPrice != null
      ? `Realized (est.): ${formatMoney(computeRealizedPnl(previewDraft))}`
      : `Unrealized (est.): ${formatMoney(computeUnrealizedPnl(previewDraft))}`);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (readOnlySession) return;
    if (side === "prop" && !challengeId.trim()) {
      setFormError("Select a challenge for prop-side trades.");
      return;
    }
    if (!existing && side === "prop" && challengeId.trim() !== "") {
      const ch = challenges.find((c) => c.id === challengeId);
      if (ch && !challengeAcceptsNewPropTrades(ch)) {
        setFormError(
          "This challenge no longer accepts new prop trades. Pick another account or change status in Edit challenge."
        );
        return;
      }
    }
    let sid: string | null =
      sessionId === "__none__" ? null : sessionId;

    if (createSession) {
      const id = addSession({
        date: newSessionDate,
        notes: newSessionNotes.trim(),
      });
      sid = id;
    }

    const pch =
      resolvedChallengeId != null
        ? challenges.find((x) => x.id === resolvedChallengeId)
        : undefined;
    const wsFromChallenge = pch?.identityId.trim() ?? "";
    const wsPersonal = tradeIdentityId.trim();
    const resolvedWorkspace =
      resolvedChallengeId != null ? wsFromChallenge : wsPersonal;

    if (resolvedChallengeId != null && !wsFromChallenge) {
      setFormError(
        "Challenge has no workspace — fix the challenge identity first."
      );
      return;
    }
    if (resolvedChallengeId == null && !wsPersonal) {
      setFormError("Pick a workspace for standalone personal trades.");
      return;
    }

    const exitVal = numOrEmpty(exitPrice);
    const payload: Omit<LogTrade, "id" | "createdAt" | "updatedAt"> = {
      identityId: resolvedWorkspace,
      challengeId: resolvedChallengeId,
      sessionId: sid,
      symbol: symbol.trim().toUpperCase(),
      direction,
      size: num(size, 1),
      entryPrice: num(entryPrice, 0),
      exitPrice: exitVal,
      directPnl: null,
      currentPrice: exitVal != null ? null : numOrEmpty(currentPrice),
      stopLoss: numOrEmpty(stopLoss),
      takeProfit: numOrEmpty(takeProfit),
      fees: num(fees, 0),
      notes: notes.trim(),
      screenshot: screenshot.trim() || null,
    };

    if (existing) {
      updateTrade(existing.id, payload);
    } else {
      const res = addTrade(payload);
      if (res == null) {
        setFormError(
          "Could not add trade. The session may be closed, or this challenge may no longer accept prop legs."
        );
        return;
      }
    }
    onOpenChange(false);
  }

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [sessions]
  );
  const sortedChallenges = useMemo(
    () => [...challenges].sort((a, b) => (a.name < b.name ? -1 : 1)),
    [challenges]
  );

  const sortedIdentities = useMemo(
    () =>
      [...identities].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      ),
    [identities]
  );

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <form onSubmit={onSubmit}>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit trade" : "Add trade"}</DialogTitle>
          <DialogDescription>
            Prop legs require a challenge; personal hedge legs stay without one.
            Log entry and exit — mark price sets unrealized P&amp;L while open.
          </DialogDescription>
        </DialogHeader>
        {readOnlySession ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
            This trade belongs to a closed session and cannot be edited.
          </p>
        ) : null}
        {formError ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        ) : null}
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Side</Label>
            <Select
              value={side}
              disabled={readOnlySession}
              onValueChange={(v) => {
                const s = v as "prop" | "personal";
                setSide(s);
                if (s === "personal" && challengeId.trim() !== "") {
                  const sel = challenges.find((c) => c.id === challengeId);
                  if (sel?.identityId) setTradeIdentityId(sel.identityId);
                }
                if (s === "personal") setChallengeId("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prop">Prop (evaluation account)</SelectItem>
                <SelectItem value="personal">Personal / hedge</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {side === "prop" ? (
            <div className="space-y-2">
              <Label>Challenge</Label>
              <Select
                value={challengeId || undefined}
                onValueChange={setChallengeId}
                disabled={readOnlySession}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select challenge" />
                </SelectTrigger>
                <SelectContent>
                  {sortedChallenges.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sortedChallenges.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Create a challenge first (cards above).
                </p>
              ) : null}
            </div>
          ) : null}

          {side === "personal" ? (
            <div className="space-y-2">
              <Label htmlFor="trade-ws">Workspace</Label>
              <Select
                value={tradeIdentityId !== "" ? tradeIdentityId : undefined}
                onValueChange={setTradeIdentityId}
                disabled={readOnlySession}
              >
                <SelectTrigger id="trade-ws">
                  <SelectValue placeholder="Select workspace" />
                </SelectTrigger>
                <SelectContent>
                  {sortedIdentities.map((it) => (
                    <SelectItem key={it.id} value={it.id}>
                      {it.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Matches Overview scope and groups personal legs before hedging.
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Session</Label>
            <Select
              value={createSession ? undefined : sessionId}
              onValueChange={(v) => {
                setCreateSession(false);
                setSessionId(v as string | "__none__");
              }}
              disabled={createSession}
            >
              <SelectTrigger>
                <SelectValue placeholder="No session" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No session</SelectItem>
                {sortedSessions.map((s: LogSession) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.date}
                    {s.closed ? " (closed)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Checkbox
                id="new-sess"
                checked={createSession}
                onCheckedChange={(v) => {
                  setCreateSession(v === true);
                  if (v === true) setSessionId("__none__");
                }}
              />
              <Label htmlFor="new-sess">Create new session</Label>
            </div>
            {createSession ? (
              <div className="grid gap-2 rounded-md border p-3">
                <div>
                  <Label htmlFor="ns-date">Session date</Label>
                  <Input
                    id="ns-date"
                    type="date"
                    value={newSessionDate}
                    onChange={(e) => setNewSessionDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="ns-notes">Session notes</Label>
                  <Textarea
                    id="ns-notes"
                    rows={2}
                    value={newSessionNotes}
                    onChange={(e) => setNewSessionNotes(e.target.value)}
                    placeholder="1–3 lines…"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sym">Symbol</Label>
            <Input
              id="sym"
              required
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="MES"
            />
          </div>
          <div className="space-y-2">
            <Label>Direction</Label>
            <Select
              value={direction}
              onValueChange={(v) => setDirection(v as TradeDirection)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="long">Long</SelectItem>
                <SelectItem value="short">Short</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sz">Size</Label>
              <Input
                id="sz"
                type="number"
                step="any"
                required
                value={size}
                onChange={(e) => setSize(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ent">Entry</Label>
              <Input
                id="ent"
                type="number"
                step="any"
                required
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ex">Exit (optional)</Label>
              <Input
                id="ex"
                type="number"
                step="any"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mark">Mark / current (if open)</Label>
              <Input
                id="mark"
                type="number"
                step="any"
                value={currentPrice}
                onChange={(e) => setCurrentPrice(e.target.value)}
                disabled={numOrEmpty(exitPrice) != null}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sl">Stop loss</Label>
              <Input
                id="sl"
                type="number"
                step="any"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tp">Take profit</Label>
              <Input
                id="tp"
                type="number"
                step="any"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fees">Fees</Label>
            <Input
              id="fees"
              type="number"
              step="0.01"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shot">Screenshot URL</Label>
            <Input
              id="shot"
              value={screenshot}
              onChange={(e) => setScreenshot(e.target.value)}
            />
          </div>
          {previewText ? (
            <p className="text-xs text-muted-foreground">{previewText}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={readOnlySession}>
            Save
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
