"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dateFromCreatedAt, formatMoney } from "@/models/trade-log/format";
import { displayPnl } from "@/models/trade-log/pnl";
import {
  oppositeTradeForRow,
  pairIdForTrade,
  tradeStep,
} from "@/models/trade-log/trade-step";
import type {
  Challenge,
  HedgePair,
  LogSession,
  LogTrade,
} from "@/models/trade-log/types";
import { useTradingStore } from "@/models/trade-log/store";

export function tradeRowLabel(t: LogTrade) {
  return `${t.symbol} · ${t.direction} · ${t.size}`;
}

function pairForTrade(
  tradeId: string,
  pairs: HedgePair[]
): HedgePair | undefined {
  return pairs.find(
    (p) => p.propTradeId === tradeId || p.personalTradeId === tradeId
  );
}

type Props = {
  trades: LogTrade[];
  sessions: LogSession[];
  pairs: HedgePair[];
  challenges: Challenge[];
  onAdd: () => void;
  onEdit?: (trade: LogTrade) => void;
  onLink?: (trade: LogTrade) => void;
};

export function TradesTable({
  trades,
  sessions,
  pairs,
  challenges,
  onAdd,
  onEdit,
  onLink,
}: Props) {
  const deleteTrade = useTradingStore((s) => s.deleteTrade);
  const sessionById = new Map(sessions.map((s) => [s.id, s] as const));
  const challengeById = useMemo(
    () => new Map(challenges.map((c) => [c.id, c] as const)),
    [challenges]
  );

  function rowDate(t: LogTrade): string {
    if (t.sessionId) {
      const sess = sessionById.get(t.sessionId);
      if (sess) return sess.date;
    }
    return dateFromCreatedAt(t.createdAt);
  }

  const colCount = 13;

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Trades</h2>
          <p className="text-xs text-muted-foreground">
            Click Edit on a row to change symbol, size, or prices.
          </p>
        </div>
        <Button type="button" size="sm" onClick={onAdd}>
          Add trade
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Challenge</th>
              <th className="px-3 py-2 font-medium">Symbol</th>
              <th className="px-3 py-2 font-medium">Dir</th>
              <th className="px-3 py-2 font-medium text-right">Size</th>
              <th className="px-3 py-2 font-medium text-right">Entry</th>
              <th className="px-3 py-2 font-medium text-right">Exit</th>
              <th className="px-3 py-2 font-medium text-right">P&amp;L</th>
              <th className="px-3 py-2 font-medium">Opposite</th>
              <th className="px-3 py-2 font-medium text-right">Combined</th>
              <th className="px-3 py-2 font-medium">Step</th>
              <th className="px-3 py-2 font-medium">Pair</th>
              <th className="px-3 py-2 font-medium text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td
                  colSpan={colCount}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No trades yet. Add one to start logging.
                </td>
              </tr>
            ) : (
              trades.map((t) => {
                const { kind, value } = displayPnl(t);
                const pnlClass =
                  value > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : value < 0
                      ? "text-red-600 dark:text-red-400"
                      : "";
                const step = tradeStep(t, pairs, trades);
                const pid = pairIdForTrade(t.id, pairs);
                const isPaired = pid != null;
                const sess = t.sessionId
                  ? sessionById.get(t.sessionId)
                  : undefined;
                const readOnly = sess?.closed === true;
                const pairRow = pairForTrade(t.id, pairs);
                const opposite = oppositeTradeForRow(t.id, pairs, trades);
                const oppPnl = opposite ? displayPnl(opposite) : null;
                const combined = pairRow?.combinedPnl;
                const combinedClass =
                  combined != null
                    ? combined > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : combined < 0
                        ? "text-red-600 dark:text-red-400"
                        : ""
                    : "";

                const chName =
                  t.challengeId != null
                    ? (challengeById.get(t.challengeId)?.name ?? "—")
                    : "Personal";

                const linkDisabled = isPaired || readOnly || !onLink;

                return (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {rowDate(t)}
                    </td>
                    <td className="max-w-[140px] px-3 py-2 text-muted-foreground">
                      {chName}
                    </td>
                    <td className="px-3 py-2 font-medium">{t.symbol}</td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{t.direction}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {t.size}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {t.entryPrice}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {t.exitPrice != null ? t.exitPrice : "Open"}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-medium tabular-nums ${pnlClass}`}
                    >
                      <span>{formatMoney(value)}</span>
                      {kind === "unrealized" ? (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          open
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[200px] px-3 py-2 text-xs text-muted-foreground">
                      {opposite ? (
                        <span>
                          {tradeRowLabel(opposite)} —{" "}
                          <span
                            className={
                              (oppPnl?.value ?? 0) > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : (oppPnl?.value ?? 0) < 0
                                  ? "text-red-600 dark:text-red-400"
                                  : ""
                            }
                          >
                            {oppPnl ? formatMoney(oppPnl.value) : "—"}
                          </span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-medium tabular-nums ${combinedClass}`}
                    >
                      {combined != null ? formatMoney(combined) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="max-w-[9rem] whitespace-normal text-center text-[10px] leading-tight">
                        {step}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {pid ? (
                        <Badge variant="secondary">Linked</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {!readOnly ? (
                          <>
                            {onEdit ? (
                              <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                className="h-8"
                                onClick={() => onEdit(t)}
                              >
                                Edit
                              </Button>
                            ) : null}
                            {onLink && !isPaired ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                className="h-8"
                                disabled={linkDisabled}
                                onClick={() => onLink(t)}
                              >
                                Link hedge
                              </Button>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              className="h-8 text-destructive"
                              onClick={() => {
                                if (
                                  confirm(
                                    "Delete this trade? Paired rows should be unlinked first if needed."
                                  )
                                ) {
                                  deleteTrade(t.id);
                                }
                              }}
                            >
                              Delete
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Closed session
                          </span>
                        )}
                      </div>
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
