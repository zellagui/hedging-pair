"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { PairStatusBadge } from "@/components/trade-log/pair-status-badge";
import { tradeRowLabel } from "@/components/trade-log/trades-table";
import { formatMoney } from "@/models/trade-log/format";
import type { HedgePair, LogTrade } from "@/models/trade-log/types";
import { useTradingStore } from "@/models/trade-log/store";

type Props = {
  pairs: HedgePair[];
  trades: LogTrade[];
  challenges: { id: string; name: string }[];
};

export function HedgePairsTable({ pairs, trades, challenges }: Props) {
  const unlinkPair = useTradingStore((s) => s.unlinkPair);

  const tradeById = useMemo(
    () => new Map(trades.map((t) => [t.id, t] as const)),
    [trades]
  );
  const challengeById = useMemo(
    () => new Map(challenges.map((c) => [c.id, c] as const)),
    [challenges]
  );

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <h2 className="text-base font-semibold">Hedge pairs</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Combined P&amp;L updates when trade legs or prices change.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Challenge</th>
              <th className="px-3 py-2 font-medium">Prop</th>
              <th className="px-3 py-2 font-medium">Personal</th>
              <th className="px-3 py-2 font-medium text-right">Combined</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {pairs.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No pairs yet. Link two trades from the table above.
                </td>
              </tr>
            ) : (
              pairs.map((p) => {
                const pt = tradeById.get(p.propTradeId);
                const ht = tradeById.get(p.personalTradeId);
                const chName =
                  pt?.challengeId != null
                    ? challengeById.get(pt.challengeId)?.name ?? "—"
                    : "—";
                const pnlClass =
                  p.combinedPnl > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : p.combinedPnl < 0
                      ? "text-red-600 dark:text-red-400"
                      : "";
                return (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="max-w-[140px] px-3 py-2 text-muted-foreground">
                      {chName}
                    </td>
                    <td className="max-w-[220px] px-3 py-2 whitespace-normal">
                      {pt ? tradeRowLabel(pt) : "Missing"}
                    </td>
                    <td className="max-w-[220px] px-3 py-2 whitespace-normal">
                      {ht ? tradeRowLabel(ht) : "Missing"}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-medium tabular-nums ${pnlClass}`}
                    >
                      {formatMoney(p.combinedPnl)}
                    </td>
                    <td className="px-3 py-2">
                      <PairStatusBadge status={p.status} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        type="button"
                        onClick={() => unlinkPair(p.id)}
                      >
                        Unlink
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
