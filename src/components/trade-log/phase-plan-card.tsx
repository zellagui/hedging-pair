"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { formatMoney } from "@/models/trade-log/format";
import { 
  computeHedgeResults, 
  type HedgePlanInput,
  type HedgePlanResult 
} from "@/models/trade-log/hedge-planner";
import type { PhasePlan } from "@/models/trade-log/types";
import { useTradingStore } from "@/models/trade-log/store";
import { cn } from "@/lib/utils";

type Props = {
  plan: PhasePlan;
  onEdit?: (plan: PhasePlan) => void;
  onDelete?: (planId: string) => void;
  onExecute?: (plan: PhasePlan) => void;
  linkedPairExists?: boolean;
};

function planStatusBadge(status: PhasePlan["status"]) {
  const label = status === "planned" ? "Planned" : status === "open" ? "Open" : "Closed";
  const emoji = status === "planned" ? "📋" : status === "open" ? "🟡" : "🟢";
  
  const cls = cn(
    "border-0 font-medium shadow-none",
    status === "planned" && "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200",
    status === "open" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-200",
    status === "closed" && "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200"
  );

  return (
    <Badge className={cls}>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden>{emoji}</span>
        <span>{label}</span>
      </span>
    </Badge>
  );
}

export function PhasePlanCard({ 
  plan, 
  onEdit, 
  onDelete, 
  onExecute, 
  linkedPairExists = false 
}: Props) {
  const challenge = useTradingStore((s) => s.challenges.find((c) => c.id === plan.challengeId));
  
  // Convert PhasePlan to HedgePlanInput and calculate results using unified engine
  const results = useMemo(() => {
    if (!challenge) return null;
    
    try {
      const hedgeInput: HedgePlanInput = {
        propTpUsd: plan.propTpUsd,
        propSlUsd: plan.propSlUsd,
        propContracts: plan.propContracts,
        personalTargetProfit: plan.personalTargetProfit,
        personalPointValue: plan.personalPointValue,
        buffer: plan.buffer,
        lotStep: plan.lotStep,
        minLot: plan.minLot,
        challengeFee: challenge.fee,
        expectedPayout: plan.expectedPayout
      };
      
      return computeHedgeResults(hedgeInput);
    } catch (error) {
      console.error("Error calculating plan results:", error);
      return null;
    }
  }, [plan, challenge?.fee]);

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Phase #{plan.phaseNumber}</div>
            <div className="text-sm text-muted-foreground">
              {results?.propDirection.toUpperCase()} {plan.propContracts}ct → {results?.personalDirection.toUpperCase()} {results?.roundedLots.toFixed(1)} lots
              {results && (
                <span className="ml-2 text-emerald-600">
                  (${(results.personalTpPoints * results.roundedLots * plan.personalPointValue).toFixed(0)} target)
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {planStatusBadge(plan.status)}
            {onEdit && (
              <Button size="sm" variant="ghost" onClick={() => onEdit(plan)}>
                ✏️
              </Button>
            )}
            {onDelete && (
              <Button size="sm" variant="ghost" onClick={() => onDelete(plan.id)}>
                🗑️
              </Button>
            )}
            {onExecute && !linkedPairExists && (
              <Button size="sm" variant="outline" onClick={() => onExecute(plan)}>
                Execute
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}