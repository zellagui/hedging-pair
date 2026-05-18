"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { CloseLegDialog } from "@/components/trade-log/close-leg-dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatMoney, formatShortMonthDay } from "@/models/trade-log/format";
import {
  getPairLifecycleStep,
  pairLifecycleStepBadgeText,
  pairLifecycleStepLabel,
} from "@/models/trade-log/pair-lifecycle";
import {
  computeUnrealizedPnl,
  effectiveLegPnl,
  isLegClosed,
} from "@/models/trade-log/pnl";
import type { HedgePair, LogTrade } from "@/models/trade-log/types";

function pnlClassReal(v: number) {
  if (v > 0) return "text-green-500";
  if (v < 0) return "text-red-500";
  return "text-muted-foreground";
}

const TIP_PROP_HDR =
  "Prop firm account — NOT your real money. Gains count toward passing. Losses risk the challenge.";
const TIP_PERSONAL_HDR =
  "Your personal account — real money, immediate.";
const TIP_REAL_PNL_COL = "Personal account P&L for this phase";

function LegCompactCell({
  trade,
  variant,
}: {
  trade: LogTrade;
  variant: "prop" | "personal";
}) {
  const sizeLabel =
    trade.size > 0
      ? `${trade.size % 1 === 0 ? String(trade.size) : trade.size.toFixed(2)}L`
      : "—";

  const arrow = trade.direction === "long" ? "▲" : "▼";
  const dirLabel = trade.direction === "long" ? "Long" : "Short";

  const line2 = (() => {
    if (isLegClosed(trade)) {
      const v = effectiveLegPnl(trade);
      if (variant === "prop") {
        return (
          <div className="text-xs text-muted-foreground">
            <span className="tabular-nums">{formatMoney(v)}</span>
            <span className="ml-1 text-[10px] text-muted-foreground">
              challenge progress
            </span>
          </div>
        );
      }
      return (
        <div className={cn("text-xs font-normal tabular-nums", pnlClassReal(v))}>
          {formatMoney(v)}
          <span className="ml-1 text-[10px] font-normal text-muted-foreground">
            your money
          </span>
        </div>
      );
    }
    const u = computeUnrealizedPnl(trade);
    const body = (
      <span className={cn("tabular-nums", variant === "personal" && pnlClassReal(u))}>
        ~{formatMoney(u)} unrealized
      </span>
    );
    if (variant === "prop") {
      return <div className="text-xs text-muted-foreground">{body}</div>;
    }
    return <div className="text-xs font-normal">{body}</div>;
  })();

  return (
    <div className="space-y-0.5">
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-1.5 gap-y-0 text-sm",
          variant === "prop" ? "text-muted-foreground" : "text-foreground"
        )}
      >
        <Badge
          variant="outline"
          className="h-5 border px-1.5 py-0 text-[10px] font-medium capitalize"
        >
          {dirLabel} {arrow}
        </Badge>
        <span className="font-medium">{trade.symbol}</span>
        <span className="tabular-nums text-xs opacity-80">{sizeLabel}</span>
      </div>
      {line2}
    </div>
  );
}

export type ChallengeHedgePairsTableProps = {
  pairs: HedgePair[];
  trades: LogTrade[];
  challengeId: string;
  updateTrade: (id: string, patch: Partial<Omit<LogTrade, "id">>) => void;
  deleteHedgePairCascade: (pairId: string) => boolean;
  unlinkDisabled?: boolean;
  onRequestLogPhase?: () => void;
};

type CloseLegTarget = { trade: LogTrade; phase: number };

export function ChallengeHedgePairsTable({
  pairs,
  trades,
  challengeId,
  updateTrade,
  deleteHedgePairCascade,
  unlinkDisabled,
  onRequestLogPhase,
}: ChallengeHedgePairsTableProps) {
  const [closeLeg, setCloseLeg] = useState<CloseLegTarget | null>(null);
  const [pairPendingDelete, setPairPendingDelete] = useState<{
    pair: HedgePair;
    phaseN: number;
  } | null>(null);

  const tradeById = new Map(trades.map((t) => [t.id, t] as const));

  const list = pairs
    .filter((p) => {
      const prop = tradeById.get(p.propTradeId);
      return prop?.challengeId === challengeId;
    })
    .sort((a, b) =>
      a.phaseNumber !== b.phaseNumber
        ? a.phaseNumber - b.phaseNumber
        : a.createdAt.localeCompare(b.createdAt)
    );

  if (list.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">No phases yet.</p>
        <p className="mx-auto mt-3 max-w-md text-pretty leading-relaxed">
          Each phase = one prop trade + one opposite personal trade.
        </p>
        {onRequestLogPhase ? (
          <Button
            type="button"
            className="mt-6"
            disabled={unlinkDisabled}
            title={
              unlinkDisabled
                ? "This challenge does not allow changes."
                : undefined
            }
            onClick={onRequestLogPhase}
          >
            + Log your first phase
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <AlertDialog
        open={pairPendingDelete != null}
        onOpenChange={(open) => {
          if (!open) setPairPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete phase?</AlertDialogTitle>
            <AlertDialogDescription>
              {pairPendingDelete
                ? `Delete phase ${pairPendingDelete.phaseN}? This removes both trades.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={unlinkDisabled}
              onClick={() => {
                if (!pairPendingDelete) return;
                deleteHedgePairCascade(pairPendingDelete.pair.id);
                setPairPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CloseLegDialog
        trade={closeLeg?.trade ?? null}
        phaseNumber={closeLeg?.phase}
        open={closeLeg != null}
        onOpenChange={(o) => {
          if (!o) setCloseLeg(null);
        }}
        updateTrade={updateTrade}
      />
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-14 min-w-[56px] align-top text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                #
              </TableHead>
              <TableHead className="min-w-[72px] align-top text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Date
              </TableHead>
              <TableHead
                className="min-w-[180px] align-top text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                title={TIP_PROP_HDR}
              >
                Prop leg
              </TableHead>
              <TableHead
                className="min-w-[180px] align-top text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                title={TIP_PERSONAL_HDR}
              >
                Personal leg
              </TableHead>
              <TableHead
                className="min-w-[88px] text-right align-top text-xs font-semibold uppercase tracking-wide text-muted-foreground tabular-nums"
                title={TIP_REAL_PNL_COL}
              >
                Real P&amp;L
              </TableHead>
              <TableHead className="w-10 text-center align-top text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Step
              </TableHead>
              <TableHead className="min-w-[160px] text-right align-top text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((pair) => {
              const propT = tradeById.get(pair.propTradeId);
              const perT = tradeById.get(pair.personalTradeId);
              const step = getPairLifecycleStep(propT, perT);
              const perPnlNum = perT != null ? effectiveLegPnl(perT) : 0;
              const canCloseProp =
                propT != null && !isLegClosed(propT) && !unlinkDisabled;
              const canClosePer =
                perT != null && !isLegClosed(perT) && !unlinkDisabled;
              const stepText = pairLifecycleStepBadgeText(step);
              const stepIconOnly = stepText.split(/\s/)[0] ?? stepText;
              const phaseN = pair.phaseNumber;
              return (
                <TableRow key={pair.id} className="hover:bg-muted/30">
                  <TableCell className="align-top py-2 text-xs tabular-nums text-muted-foreground">
                    Phase {phaseN}
                  </TableCell>
                  <TableCell className="align-top py-2 text-sm tabular-nums text-muted-foreground">
                    {formatShortMonthDay(pair.createdAt)}
                  </TableCell>
                  <TableCell className="align-top py-2">
                    {propT ? (
                      <LegCompactCell trade={propT} variant="prop" />
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="align-top py-2">
                    {perT ? (
                      <LegCompactCell trade={perT} variant="personal" />
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "align-top py-2 text-right text-sm font-bold tabular-nums",
                      perT != null ? pnlClassReal(perPnlNum) : "text-muted-foreground"
                    )}
                    title={TIP_REAL_PNL_COL}
                  >
                    {perT != null ? formatMoney(perPnlNum) : "—"}
                  </TableCell>
                  <TableCell className="align-top py-2 text-center text-base leading-none">
                    <span
                      title={pairLifecycleStepLabel(step)}
                      aria-label={pairLifecycleStepLabel(step)}
                    >
                      {stepIconOnly}
                    </span>
                  </TableCell>
                  <TableCell className="align-top py-2 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {canCloseProp ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 gap-0.5 px-2 text-xs"
                          aria-label="Close prop-firm leg"
                          onClick={() =>
                            setCloseLeg({ trade: propT, phase: phaseN })
                          }
                        >
                          Close prop <span aria-hidden>↓</span>
                        </Button>
                      ) : null}
                      {canClosePer ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 gap-0.5 px-2 text-xs"
                          aria-label="Close personal hedge leg"
                          onClick={() =>
                            setCloseLeg({ trade: perT, phase: phaseN })
                          }
                        >
                          Close pers <span aria-hidden>↓</span>
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={unlinkDisabled}
                        title={
                          unlinkDisabled
                            ? "This challenge does not allow changes."
                            : "Delete phase"
                        }
                        aria-label="Delete phase"
                        onClick={() =>
                          setPairPendingDelete({ pair, phaseN })
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
