"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import { formatMoney } from "@/models/trade-log/format";
import { displayPnl } from "@/models/trade-log/pnl";
import { useTradingStore } from "@/models/trade-log/store";
import type { LogTrade, TradeDirection } from "@/models/trade-log/types";

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

function emptyOrStr(n: number | null | undefined) {
  return n == null ? "" : String(n);
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tradeId: string | null;
  /** e.g. "Phase 2" — shown under the leg badge */
  phaseLabel?: string;
};

export function TradeEditDialog({
  open,
  onOpenChange,
  tradeId,
  phaseLabel,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <TradeEditInner
          key={tradeId ?? "none"}
          tradeId={tradeId}
          phaseLabel={phaseLabel}
          onOpenChange={onOpenChange}
        />
      ) : null}
    </Dialog>
  );
}

function TradeEditInner({
  tradeId,
  phaseLabel,
  onOpenChange,
}: {
  tradeId: string | null;
  phaseLabel?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const trade = useTradingStore((s) =>
    tradeId ? s.getTrade(tradeId) : undefined
  );
  const sessions = useTradingStore((s) => s.sessions);
  const challenges = useTradingStore((s) => s.challenges);
  const updateTrade = useTradingStore((s) => s.updateTrade);

  const readOnly =
    trade?.sessionId != null &&
    sessions.find((x) => x.id === trade.sessionId)?.closed === true;

  const challengeName =
    trade?.challengeId != null
      ? challenges.find((c) => c.id === trade.challengeId)?.name
      : null;

  const [symbol, setSymbol] = useState(() => trade?.symbol ?? "");
  const [direction, setDirection] = useState<TradeDirection>(
    () => trade?.direction ?? "long"
  );
  const [size, setSize] = useState(() =>
    trade ? String(trade.size) : "1"
  );
  const [entryPrice, setEntryPrice] = useState(() =>
    trade ? String(trade.entryPrice) : ""
  );
  const [exitPrice, setExitPrice] = useState(() =>
    trade ? emptyOrStr(trade.exitPrice) : ""
  );
  const [directPnl, setDirectPnl] = useState(() =>
    trade ? emptyOrStr(trade.directPnl) : ""
  );
  const [currentPrice, setCurrentPrice] = useState(() =>
    trade ? emptyOrStr(trade.currentPrice) : ""
  );
  const [fees, setFees] = useState(() =>
    trade ? String(trade.fees) : "0"
  );
  const [notes, setNotes] = useState(() => trade?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const previewPnl = useMemo(() => {
    if (!trade) return null;
    const draft: LogTrade = {
      ...trade,
      symbol: symbol.trim() || trade.symbol,
      direction,
      size: num(size, trade.size),
      entryPrice: num(entryPrice, trade.entryPrice),
      exitPrice: numOrEmpty(exitPrice),
      directPnl: numOrEmpty(directPnl),
      currentPrice:
        numOrEmpty(exitPrice) != null || numOrEmpty(directPnl) != null
          ? null
          : numOrEmpty(currentPrice),
      fees: num(fees, 0),
    };
    return displayPnl(draft);
  }, [
    trade,
    symbol,
    direction,
    size,
    entryPrice,
    exitPrice,
    directPnl,
    currentPrice,
    fees,
  ]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!trade || readOnly) return;
    setError(null);

    const sym = symbol.trim().toUpperCase();
    if (!sym) {
      setError("Symbol is required.");
      return;
    }

    const exitVal = numOrEmpty(exitPrice);
    const directVal = numOrEmpty(directPnl);

    updateTrade(trade.id, {
      symbol: sym,
      direction,
      size: num(size, trade.size),
      entryPrice: num(entryPrice, trade.entryPrice),
      exitPrice: exitVal,
      directPnl: directVal,
      currentPrice:
        exitVal != null || directVal != null ? null : numOrEmpty(currentPrice),
      fees: num(fees, 0),
      notes: notes.trim(),
    });
    onOpenChange(false);
  }

  const isProp = trade?.challengeId != null;
  const legLabel = isProp ? "Prop leg" : "Personal leg";

  return (
    <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        {trade ? (
          <form onSubmit={handleSave}>
            <DialogHeader className="space-y-3 border-b border-border bg-muted/30 px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={isProp ? "secondary" : "default"}
                  className={cn(
                    "text-xs font-medium",
                    isProp
                      ? "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100"
                      : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
                  )}
                >
                  {legLabel}
                </Badge>
                {phaseLabel ? (
                  <Badge variant="outline" className="text-xs">
                    {phaseLabel}
                  </Badge>
                ) : null}
              </div>
              <div>
                <DialogTitle className="text-xl">Edit trade</DialogTitle>
                <DialogDescription className="mt-1.5 text-sm">
                  {isProp && challengeName ? (
                    <>
                      <span className="font-medium text-foreground">
                        {challengeName}
                      </span>
                      {" · "}
                    </>
                  ) : null}
                  Update symbol, size, and prices — then save.
                </DialogDescription>
              </div>
              {previewPnl ? (
                <div className="inline-flex items-baseline gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <span className="text-muted-foreground">P&amp;L:</span>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      previewPnl.value > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : previewPnl.value < 0
                          ? "text-red-600 dark:text-red-400"
                          : ""
                    )}
                  >
                    {formatMoney(previewPnl.value)}
                  </span>
                  {previewPnl.kind === "unrealized" ? (
                    <span className="text-xs text-muted-foreground">(open)</span>
                  ) : null}
                </div>
              ) : null}
            </DialogHeader>

            <div className="max-h-[min(60vh,32rem)] space-y-4 overflow-y-auto px-6 py-5">
              {readOnly ? (
                <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                  This trade belongs to a closed session and cannot be edited.
                </p>
              ) : null}
              {error ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <FormSection title="Position">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="edit-trade-symbol">Symbol</Label>
                    <Input
                      id="edit-trade-symbol"
                      value={symbol}
                      disabled={readOnly}
                      onChange={(e) => setSymbol(e.target.value)}
                      placeholder="MES"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Direction</Label>
                    <Select
                      value={direction}
                      disabled={readOnly}
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
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-trade-size">Size (lots)</Label>
                    <Input
                      id="edit-trade-size"
                      type="number"
                      step="any"
                      value={size}
                      disabled={readOnly}
                      onChange={(e) => setSize(e.target.value)}
                    />
                  </div>
                </div>
              </FormSection>

              <FormSection title="Prices & P&amp;L">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-trade-entry">Entry price</Label>
                    <Input
                      id="edit-trade-entry"
                      type="number"
                      step="any"
                      value={entryPrice}
                      disabled={readOnly}
                      onChange={(e) => setEntryPrice(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-trade-exit">Exit price</Label>
                    <Input
                      id="edit-trade-exit"
                      type="number"
                      step="any"
                      value={exitPrice}
                      disabled={readOnly}
                      placeholder="Leave empty if open"
                      onChange={(e) => setExitPrice(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-trade-direct-pnl">Direct P&amp;L</Label>
                    <Input
                      id="edit-trade-direct-pnl"
                      type="number"
                      step="any"
                      value={directPnl}
                      disabled={readOnly}
                      placeholder="Optional — skips price math"
                      onChange={(e) => setDirectPnl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-trade-mark">Mark price (if open)</Label>
                    <Input
                      id="edit-trade-mark"
                      type="number"
                      step="any"
                      value={currentPrice}
                      disabled={
                        readOnly ||
                        numOrEmpty(exitPrice) != null ||
                        numOrEmpty(directPnl) != null
                      }
                      placeholder="For unrealized P&amp;L"
                      onChange={(e) => setCurrentPrice(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use exit price to close by price, or direct P&amp;L to enter the
                  realized amount manually.
                </p>
              </FormSection>

              <FormSection title="Other">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-trade-fees">Fees</Label>
                    <Input
                      id="edit-trade-fees"
                      type="number"
                      step="0.01"
                      value={fees}
                      disabled={readOnly}
                      onChange={(e) => setFees(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-trade-notes">Notes</Label>
                    <Textarea
                      id="edit-trade-notes"
                      rows={3}
                      value={notes}
                      disabled={readOnly}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional context…"
                    />
                  </div>
                </div>
              </FormSection>
            </div>

            <DialogFooter className="border-t border-border bg-muted/20 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={readOnly}>
                Save changes
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            Trade not found.
          </div>
        )}
    </DialogContent>
  );
}
