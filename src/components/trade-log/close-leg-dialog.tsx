"use client";

import { useState } from "react";

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
import { formatMoney } from "@/models/trade-log/format";
import { isLegClosed } from "@/models/trade-log/pnl";
import type { LogTrade } from "@/models/trade-log/types";

function qNum(s: string, fallback = 0) {
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

type CloseMode = "price" | "pnl";

function CloseLegFormBody({
  trade,
  phaseNumber,
  onOpenChange,
  updateTrade,
}: {
  trade: LogTrade;
  phaseNumber: number | null | undefined;
  onOpenChange: (o: boolean) => void;
  updateTrade: (id: string, patch: Partial<Omit<LogTrade, "id">>) => void;
}) {
  const [mode, setMode] = useState<CloseMode>("pnl");
  const [exitPrice, setExitPrice] = useState(() =>
    trade.exitPrice != null && Number.isFinite(trade.exitPrice)
      ? String(trade.exitPrice)
      : ""
  );
  const [fees, setFees] = useState(() => String(trade.fees ?? 0));
  const [directPnlStr, setDirectPnlStr] = useState(
    () =>
      trade.directPnl != null && Number.isFinite(trade.directPnl)
        ? String(trade.directPnl)
        : ""
  );
  const [error, setError] = useState<string | null>(null);

  const isProp = trade.challengeId != null;
  const legWord = isProp ? "prop" : "personal";
  const phaseLabel =
    phaseNumber != null && phaseNumber > 0 ? String(phaseNumber) : "—";
  const platformHint = isProp
    ? "prop firm"
    : "broker";

  const entryHint =
    trade.entryPrice !== 0 || trade.size !== 0
      ? `Entry ${formatMoney(trade.entryPrice)} · size ${trade.size} · ${trade.symbol}`
      : `${trade.symbol} · fast log`;

  return (
    <DialogContent className="sm:max-w-md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (mode === "price") {
            const exit = qNum(exitPrice, NaN);
            if (!Number.isFinite(exit)) {
              setError("Enter a valid exit price.");
              return;
            }
            updateTrade(trade.id, {
              exitPrice: exit,
              fees: qNum(fees, 0),
              currentPrice: null,
              directPnl: null,
            });
          } else {
            const pnl = qNum(directPnlStr, NaN);
            if (!Number.isFinite(pnl)) {
              setError("Enter a valid P&L.");
              return;
            }
            updateTrade(trade.id, {
              directPnl: pnl,
              exitPrice: null,
              currentPrice: null,
              fees: 0,
            });
          }
          onOpenChange(false);
        }}
      >
        <DialogHeader>
          <DialogTitle>
            Close {legWord} leg — Phase {phaseLabel}
          </DialogTitle>
          <DialogDescription>
            {entryHint}
          </DialogDescription>
        </DialogHeader>
        {isLegClosed(trade) ? (
          <p className="text-xs text-muted-foreground">
            This leg is already closed; saving overwrites the previous close.
          </p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-wrap gap-2 py-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "price" ? "default" : "outline"}
            onClick={() => setMode("price")}
          >
            Price
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "pnl" ? "default" : "outline"}
            onClick={() => setMode("pnl")}
          >
            Direct P&amp;L
          </Button>
        </div>

        {mode === "price" ? (
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="close-exit">Exit price</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  $
                </span>
                <Input
                  id="close-exit"
                  type="number"
                  step="0.01"
                  required
                  className="pl-7"
                  value={exitPrice}
                  onChange={(e) => setExitPrice(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="close-fees">Fees (this leg)</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  $
                </span>
                <Input
                  id="close-fees"
                  type="number"
                  step="0.01"
                  className="pl-7"
                  value={fees}
                  onChange={(e) => setFees(e.target.value)}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="close-pnl">P&amp;L ($)</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  $
                </span>
                <Input
                  id="close-pnl"
                  type="number"
                  step="0.01"
                  required
                  className="pl-7"
                  value={directPnlStr}
                  onChange={(e) => setDirectPnlStr(e.target.value)}
                  placeholder="Realized P&L for this leg"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Enter the P&amp;L shown on your {platformHint} platform.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit">Close leg</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export function CloseLegDialog({
  trade,
  phaseNumber,
  open,
  onOpenChange,
  updateTrade,
}: {
  trade: LogTrade | null;
  phaseNumber?: number | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  updateTrade: (id: string, patch: Partial<Omit<LogTrade, "id">>) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && trade ? (
        <CloseLegFormBody
          key={trade.id}
          trade={trade}
          phaseNumber={phaseNumber}
          onOpenChange={onOpenChange}
          updateTrade={updateTrade}
        />
      ) : null}
    </Dialog>
  );
}
