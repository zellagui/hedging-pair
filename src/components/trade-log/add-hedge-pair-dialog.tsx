"use client";

import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

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
import {
  computeRealizedPnl,
  computeUnrealizedPnl,
} from "@/models/trade-log/pnl";
import { getPairsByChallengeId } from "@/models/trade-log/challenges";
import { useTradingStore } from "@/models/trade-log/store";
import type { LogTrade, TradeDirection } from "@/models/trade-log/types";

type LogMode = "price" | "fast";

function qNum(s: string, fallback = 0) {
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function qNumOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function oppositeDirection(d: TradeDirection): TradeDirection {
  return d === "long" ? "short" : "long";
}

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  formKey: number;
  challengeId: string;
  challengeName: string;
  locked: boolean;
  addTrade: (
    input: Omit<LogTrade, "id" | "createdAt" | "updatedAt">
  ) => string | null;
  linkPair: (propTradeId: string, personalTradeId: string) => string | null;
};

function usdInputClass() {
  return "pl-7";
}

function buildPriceLeg(
  challengeId: string | null,
  identityId: string,
  legDirection: TradeDirection,
  symbol: string,
  size: number,
  entry: number,
  exitStr: string,
  markStr: string,
  feesStr: string,
  notes: string,
  screenshot: string
): Omit<LogTrade, "id" | "createdAt" | "updatedAt"> {
  const exitVal = qNumOrNull(exitStr);
  return {
    identityId,
    challengeId,
    sessionId: null,
    symbol: symbol.trim().toUpperCase(),
    direction: legDirection,
    size,
    entryPrice: entry,
    exitPrice: exitVal,
    directPnl: null,
    currentPrice: exitVal != null ? null : qNumOrNull(markStr),
    stopLoss: null,
    takeProfit: null,
    fees: qNum(feesStr, 0),
    notes: notes.trim(),
    screenshot: screenshot.trim() || null,
  };
}

function buildFastLeg(
  challengeId: string | null,
  identityId: string,
  legDirection: TradeDirection,
  symbol: string,
  directPnl: number,
  notes: string,
  screenshot: string
): Omit<LogTrade, "id" | "createdAt" | "updatedAt"> {
  return {
    identityId,
    challengeId,
    sessionId: null,
    symbol: symbol.trim().toUpperCase(),
    direction: legDirection,
    size: 1,
    entryPrice: 0,
    exitPrice: null,
    directPnl,
    currentPrice: null,
    stopLoss: null,
    takeProfit: null,
    fees: 0,
    notes: notes.trim(),
    screenshot: screenshot.trim() || null,
  };
}

function previewPriceLeg(
  direction: TradeDirection,
  size: number,
  entry: number,
  exitStr: string,
  markStr: string,
  feesStr: string
): number | null {
  const exitVal = qNumOrNull(exitStr);
  const t: LogTrade = {
    id: "",
    identityId: "preview",
    challengeId: null,
    sessionId: null,
    symbol: "",
    direction,
    size,
    entryPrice: entry,
    exitPrice: exitVal,
    directPnl: null,
    currentPrice: exitVal != null ? null : qNumOrNull(markStr),
    stopLoss: null,
    takeProfit: null,
    fees: qNum(feesStr, 0),
    notes: "",
    screenshot: null,
    createdAt: "",
    updatedAt: "",
  };
  if (t.exitPrice != null) return computeRealizedPnl(t);
  return computeUnrealizedPnl(t);
}

export function AddHedgePairDialog({
  open,
  onOpenChange,
  formKey,
  challengeId,
  challengeName,
  locked,
  addTrade,
  linkPair,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <AddHedgePairDialogInner
          key={`${formKey}-${challengeId}`}
          challengeId={challengeId}
          challengeName={challengeName}
          locked={locked}
          onOpenChange={onOpenChange}
          addTrade={addTrade}
          linkPair={linkPair}
        />
      ) : null}
    </Dialog>
  );
}

function AddHedgePairDialogInner({
  challengeId,
  challengeName,
  locked,
  onOpenChange,
  addTrade,
  linkPair,
}: Omit<Props, "open" | "formKey">) {
  const { trades, pairs, challenges } = useTradingStore(
    useShallow((s) => ({ trades: s.trades, pairs: s.pairs, challenges: s.challenges }))
  );
  const workspaceId =
    challenges.find((c) => c.id === challengeId)?.identityId.trim() ?? "";
  const nextPhase = useMemo(
    () => getPairsByChallengeId(challengeId, trades, pairs).length + 1,
    [challengeId, trades, pairs]
  );
  const [mode, setMode] = useState<LogMode>("fast");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [symbol, setSymbol] = useState("");
  const [direction, setDirection] = useState<TradeDirection>("long");
  const [size, setSize] = useState("1");
  const [entryPrice, setEntryPrice] = useState("");
  const [propExit, setPropExit] = useState("");
  const [propMark, setPropMark] = useState("");
  const [propFees, setPropFees] = useState("0");
  const [perExit, setPerExit] = useState("");
  const [perMark, setPerMark] = useState("");
  const [perFees, setPerFees] = useState("0");
  const [perSizeOverride, setPerSizeOverride] = useState("");

  const [propPnlFast, setPropPnlFast] = useState("");
  const [perPnlFast, setPerPnlFast] = useState("");

  const [notes, setNotes] = useState("");
  const [screenshot, setScreenshot] = useState("");

  const personalDir = oppositeDirection(direction);
  const sz = qNum(size, 1);
  const perSz = perSizeOverride.trim() !== "" ? qNum(perSizeOverride, sz) : sz;
  const entry = qNum(entryPrice, 0);

  const propPrev =
    mode === "price"
      ? previewPriceLeg(direction, sz, entry, propExit, propMark, propFees)
      : qNumOrNull(propPnlFast);
  const perPrev =
    mode === "price"
      ? previewPriceLeg(personalDir, perSz, entry, perExit, perMark, perFees)
      : qNumOrNull(perPnlFast);
  const combinedPrev =
    propPrev != null && perPrev != null ? propPrev + perPrev : null;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      signDisplay: "exceptZero",
    }).format(n);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (locked) {
      setSubmitError("This challenge does not accept new hedge pairs.");
      return;
    }
    if (!workspaceId) {
      setSubmitError(
        "This challenge has no workspace — try editing or re-saving the challenge."
      );
      return;
    }

    if (!symbol.trim()) {
      setSubmitError("Enter a symbol.");
      return;
    }

    if (mode === "fast") {
      const pPnl = qNumOrNull(propPnlFast);
      const hPnl = qNumOrNull(perPnlFast);
      if (pPnl == null) {
        setSubmitError("Enter prop leg P&L.");
        return;
      }
      if (hPnl == null) {
        setSubmitError("Enter personal leg P&L.");
        return;
      }
      const propPayload = buildFastLeg(
        challengeId,
        workspaceId,
        direction,
        symbol,
        pPnl,
        notes,
        screenshot
      );
      const propId = addTrade(propPayload);
      if (propId == null) {
        setSubmitError("Could not add prop leg.");
        return;
      }
      const personalPayload = buildFastLeg(
        null,
        workspaceId,
        personalDir,
        symbol.trim().toUpperCase(),
        hPnl,
        notes,
        screenshot
      );
      const personalId = addTrade(personalPayload);
      if (personalId == null) {
        setSubmitError(
          "Prop saved; personal leg failed. Fix from the trade list if needed."
        );
        return;
      }
      const linkId = linkPair(propId, personalId);
      if (linkId == null) {
        setSubmitError("Could not link legs.");
        return;
      }
      onOpenChange(false);
      return;
    }

    if (!Number.isFinite(sz) || sz <= 0) {
      setSubmitError("Size must be positive.");
      return;
    }
    if (!Number.isFinite(perSz) || perSz <= 0) {
      setSubmitError("Personal size must be positive.");
      return;
    }
    if (!Number.isFinite(entry)) {
      setSubmitError("Enter entry price.");
      return;
    }
    if (qNumOrNull(propExit) == null && qNumOrNull(propMark) == null) {
      setSubmitError(
        "Prop leg: enter exit if closed, or mark if still open."
      );
      return;
    }
    if (qNumOrNull(perExit) == null && qNumOrNull(perMark) == null) {
      setSubmitError(
        "Personal leg: enter exit if closed, or mark if still open."
      );
      return;
    }

    const propPayload = buildPriceLeg(
      challengeId,
      workspaceId,
      direction,
      symbol,
      sz,
      entry,
      propExit,
      propMark,
      propFees,
      notes,
      screenshot
    );
    const propId = addTrade(propPayload);
    if (propId == null) {
      setSubmitError("Could not add prop leg.");
      return;
    }
    const personalPayload = buildPriceLeg(
      null,
      workspaceId,
      personalDir,
      symbol,
      perSz,
      entry,
      perExit,
      perMark,
      perFees,
      notes,
      screenshot
    );
    const personalId = addTrade(personalPayload);
    if (personalId == null) {
      setSubmitError("Prop saved; personal leg failed.");
      return;
    }
    const linkId = linkPair(propId, personalId);
    if (linkId == null) {
      setSubmitError("Could not link legs.");
      return;
    }
    onOpenChange(false);
  }

  return (
    <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 p-0 sm:max-w-4xl">
      <form onSubmit={onSubmit} className="flex max-h-[inherit] flex-1 flex-col">
        <DialogHeader className="border-b border-border px-4 py-4 sm:px-6">
          <DialogTitle className="text-left">
            Log phase {nextPhase} for {challengeName}
          </DialogTitle>
          <DialogDescription className="text-left">
            One prop-firm leg and one opposite personal hedge. Fast mode is best
            when you already know each side&apos;s P&amp;L from your platforms.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {locked ? (
            <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              This challenge is closed to new phases.
            </p>
          ) : null}
          {submitError ? (
            <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {submitError}
            </p>
          ) : null}

          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "fast" ? "default" : "outline"}
              onClick={() => setMode("fast")}
            >
              ⚡ Fast mode
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "price" ? "default" : "outline"}
              onClick={() => setMode("price")}
            >
              📊 Price mode
            </Button>
          </div>

          {mode === "price" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-lg border bg-sky-500/5 p-4 dark:bg-sky-950/20">
                <p className="text-sm font-semibold">🏦 Prop firm leg</p>
                <div className="space-y-2">
                  <Label htmlFor="ahp-symbol">Symbol</Label>
                  <Input
                    id="ahp-symbol"
                    required
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="font-mono uppercase"
                    placeholder="US500"
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
                <div className="space-y-2">
                  <Label htmlFor="ahp-size">Size</Label>
                  <Input
                    id="ahp-size"
                    type="number"
                    step="0.01"
                    min="0"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ahp-entry">Entry price</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="ahp-entry"
                      type="number"
                      step="0.01"
                      className={usdInputClass()}
                      value={entryPrice}
                      onChange={(e) => setEntryPrice(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ahp-p-exit">Exit price (optional)</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="ahp-p-exit"
                      type="number"
                      step="0.01"
                      className={usdInputClass()}
                      value={propExit}
                      onChange={(e) => setPropExit(e.target.value)}
                      placeholder="Open if blank"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ahp-p-fees">Fees (optional)</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="ahp-p-fees"
                      type="number"
                      step="0.01"
                      className={usdInputClass()}
                      value={propFees}
                      onChange={(e) => setPropFees(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ahp-p-mark">Mark (if open)</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="ahp-p-mark"
                      type="number"
                      step="0.01"
                      className={usdInputClass()}
                      value={propMark}
                      onChange={(e) => setPropMark(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border bg-violet-500/5 p-4 dark:bg-violet-950/20">
                <p className="text-sm font-semibold">
                  👤 Personal leg (opposite)
                </p>
                <div className="space-y-2">
                  <Label>Symbol</Label>
                  <Input
                    readOnly
                    value={symbol.trim().toUpperCase() || "—"}
                    className="bg-muted/50 font-mono uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Direction</Label>
                  <Input
                    readOnly
                    value={`${personalDir} (mirrored)`}
                    className="bg-muted/50 capitalize"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ahp-per-size">
                    Size (default = prop; override)
                  </Label>
                  <Input
                    id="ahp-per-size"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={String(sz)}
                    value={perSizeOverride}
                    onChange={(e) => setPerSizeOverride(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ahp-per-entry">Entry price</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="ahp-per-entry"
                      type="number"
                      step="0.01"
                      className={usdInputClass()}
                      value={entryPrice}
                      readOnly
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ahp-h-exit">Exit price (optional)</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="ahp-h-exit"
                      type="number"
                      step="0.01"
                      className={usdInputClass()}
                      value={perExit}
                      onChange={(e) => setPerExit(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ahp-h-fees">Fees (optional)</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="ahp-h-fees"
                      type="number"
                      step="0.01"
                      className={usdInputClass()}
                      value={perFees}
                      onChange={(e) => setPerFees(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ahp-h-mark">Mark (if open)</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="ahp-h-mark"
                      type="number"
                      step="0.01"
                      className={usdInputClass()}
                      value={perMark}
                      onChange={(e) => setPerMark(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-lg border bg-sky-500/5 p-4 dark:bg-sky-950/20">
                <p className="text-sm font-semibold">🏦 Prop firm leg</p>
                <div className="space-y-2">
                  <Label htmlFor="ahp-f-symbol">Symbol</Label>
                  <Input
                    id="ahp-f-symbol"
                    required
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="font-mono uppercase"
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
                <div className="space-y-2">
                  <Label htmlFor="ahp-f-prop-pnl">P&amp;L ($)</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="ahp-f-prop-pnl"
                      type="number"
                      step="0.01"
                      className={usdInputClass()}
                      value={propPnlFast}
                      onChange={(e) => setPropPnlFast(e.target.value)}
                      placeholder="e.g. 115 or -80"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Challenge progress (not real cash until payout).
                  </p>
                </div>
              </div>
              <div className="space-y-3 rounded-lg border bg-violet-500/5 p-4 dark:bg-violet-950/20">
                <p className="text-sm font-semibold">
                  👤 Personal leg (opposite)
                </p>
                <div className="space-y-2">
                  <Label>Symbol</Label>
                  <Input
                    readOnly
                    value={symbol.trim().toUpperCase() || "—"}
                    className="bg-muted/50 font-mono uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Direction</Label>
                  <Input
                    readOnly
                    value={`${personalDir} (mirrored)`}
                    className="bg-muted/50 capitalize"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ahp-f-per-pnl">P&amp;L ($)</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="ahp-f-per-pnl"
                      type="number"
                      step="0.01"
                      className={usdInputClass()}
                      value={perPnlFast}
                      onChange={(e) => setPerPnlFast(e.target.value)}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Your real money on the hedge account.
                  </p>
                </div>
              </div>
            </div>
          )}

          <p className="mt-4 text-sm text-muted-foreground">
            {mode === "fast" ? (
              <>
                <span title="propPnl + personalPnl for this pair.">
                  Hedge balance:{" "}
                </span>
                <span className="font-mono font-medium text-foreground">
                  {combinedPrev != null ? fmt(combinedPrev) : "—"}
                </span>
                <span className="mx-1.5">·</span>
                <span title="Personal leg only — your real cash flow on this phase.">
                  Your real gain:{" "}
                </span>
                <span className="font-mono font-medium text-foreground">
                  {qNumOrNull(perPnlFast) != null
                    ? fmt(qNumOrNull(perPnlFast)!)
                    : "—"}
                </span>
              </>
            ) : (
              <>
                Est. prop P&amp;L:{" "}
                <span className="font-mono text-foreground">
                  {propPrev != null ? fmt(propPrev) : "—"}
                </span>
                {" · "}
                Est. personal P&amp;L:{" "}
                <span className="font-mono text-foreground">
                  {perPrev != null ? fmt(perPrev) : "—"}
                </span>
                {" · "}
                Balance:{" "}
                <span className="font-mono font-medium text-foreground">
                  {combinedPrev != null ? fmt(combinedPrev) : "—"}
                </span>
              </>
            )}
          </p>

          <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ahp-notes">Notes (optional, both legs)</Label>
              <Textarea
                id="ahp-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ahp-shot">Screenshot URL (optional)</Label>
              <Input
                id="ahp-shot"
                value={screenshot}
                onChange={(e) => setScreenshot(e.target.value)}
                placeholder="https://"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-border px-4 py-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={locked}>
            Log phase {nextPhase}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
