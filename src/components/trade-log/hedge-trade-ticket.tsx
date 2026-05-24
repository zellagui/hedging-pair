"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/models/trade-log/format";
import type { HedgePlanResult, HedgePlanInput } from "@/models/trade-log/hedge-planner";
import type { Challenge } from "@/models/trade-log/types";

interface TradeTicketProps {
  results: HedgePlanResult;
  inputs: HedgePlanInput;
  challenge: Challenge;
}

export function HedgeTradeTicket({ results, inputs, challenge }: TradeTicketProps) {
  // Calculate additional context
  const personalWinUsd = results.personalTpPoints * results.roundedLots * inputs.personalPointValue;
  const personalLossUsd = results.personalSlPoints * results.roundedLots * inputs.personalPointValue;
  const feeCovered = personalWinUsd >= challenge.fee;
  const riskRewardRatio = personalWinUsd / personalLossUsd;
  const lotRounding = results.rawLots > 0 ? ((results.roundedLots - results.rawLots) / results.rawLots * 100) : 0;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">Trade Setup</CardTitle>
          {feeCovered && (
            <Badge variant="outline" className="text-xs text-green-600">
              Fee Covered
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        
        {/* Prop Account - Contracts First */}
        <div className="border-l-2 border-blue-500 pl-3">
          <div className="text-sm text-muted-foreground">Prop Account</div>
          <div className="text-lg font-semibold mb-2">
            {inputs.propContracts} contracts ES {results.propDirection.toUpperCase()}
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>TP: {results.propTpPoints.toFixed(1)} pts</span>
              <span className="font-medium">{formatMoney(results.propTpUsd)}</span>
            </div>
            <div className="flex justify-between">
              <span>SL: {results.propSlPoints.toFixed(1)} pts</span>
              <span className="font-medium">{formatMoney(results.propSlUsd)}</span>
            </div>
          </div>
        </div>

        {/* Personal Hedge - Lots First */}
        <div className="border-l-2 border-green-500 pl-3">
          <div className="text-sm text-muted-foreground">Your Hedge Trade</div>
          <div className="text-xl font-bold mb-2">
            {results.roundedLots.toFixed(1)} lots ES {results.personalDirection.toUpperCase()}
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>TP: {results.personalTpPoints.toFixed(1)} pts</span>
              <span className="font-medium">{formatMoney(personalWinUsd)}</span>
            </div>
            <div className="flex justify-between">
              <span>SL: {results.personalSlPoints.toFixed(1)} pts</span>
              <span className="font-medium">{formatMoney(personalLossUsd)}</span>
            </div>
          </div>
        </div>

        {/* Outcomes */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">If prop fails</div>
            <div className="text-lg font-semibold text-green-600">
              {formatMoney(results.failScenario.hedgeProfitAfterFee)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">If prop passes</div>
            <div className="text-lg font-semibold text-red-600">
              -{formatMoney(personalLossUsd)} loss
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}