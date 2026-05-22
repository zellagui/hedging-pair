"use client";

import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { PairLinkDialog } from "@/components/trade-log/pair-link-dialog";
import { TradeEditDialog } from "@/components/trade-log/trade-edit-dialog";
import { TradeFormDialog } from "@/components/trade-log/trade-form-dialog";
import { TradesTable } from "@/components/trade-log/trades-table";
import { Input } from "@/components/ui/input";
import { useTradingStore } from "@/models/trade-log/store";
import type { LogTrade } from "@/models/trade-log/types";

export function TradesIndexPage() {
  const { trades, sessions, pairs, challenges } = useTradingStore(
    useShallow((s) => ({
      trades: s.trades,
      sessions: s.sessions,
      pairs: s.pairs,
      challenges: s.challenges,
    }))
  );

  const [q, setQ] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editTradeId, setEditTradeId] = useState<string | null>(null);
  const [linkTrade, setLinkTrade] = useState<LogTrade | null>(null);

  const sorted = useMemo(
    () => [...trades].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [trades]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter((t) => {
      const sym = t.symbol.toLowerCase();
      const notes = t.notes.toLowerCase();
      const ch =
        t.challengeId != null
          ? (challenges.find((c) => c.id === t.challengeId)?.name.toLowerCase() ??
            "")
          : "personal";
      return sym.includes(needle) || notes.includes(needle) || ch.includes(needle);
    });
  }, [sorted, q, challenges]);

  return (
    <div className="space-y-6">
      <TradeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tradeId={null}
      />

      <TradeEditDialog
        open={editTradeId != null}
        onOpenChange={(o) => {
          if (!o) setEditTradeId(null);
        }}
        tradeId={editTradeId}
      />

      <PairLinkDialog
        open={linkTrade != null}
        onOpenChange={(o) => {
          if (!o) setLinkTrade(null);
        }}
        anchorTradeId={linkTrade?.id ?? null}
      />

      <div>
        <h2 className="text-xl font-semibold tracking-tight">Trades</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          All journal legs in one place. Use Edit on a row to update a trade.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 sm:flex-row sm:items-center">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search symbol, notes, challenge…"
          autoComplete="off"
          className="h-8 max-w-full text-xs sm:max-w-[16rem]"
          aria-label="Search trades"
        />
        <span className="text-[11px] tabular-nums text-muted-foreground sm:ml-auto">
          {filtered.length}/{sorted.length}
        </span>
      </div>

      <TradesTable
        trades={filtered}
        sessions={sessions}
        pairs={pairs}
        challenges={challenges}
        onAdd={() => {
          setEditTradeId(null);
          setFormOpen(true);
        }}
        onEdit={(t) => setEditTradeId(t.id)}
        onLink={(t) => setLinkTrade(t)}
      />
    </div>
  );
}
