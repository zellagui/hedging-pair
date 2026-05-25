"use client";

import { useState, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { formatMoney } from "@/models/trade-log/format";
import { getPairsByChallengeId } from "@/models/trade-log/challenges";
import { 
  computeHedgeResults,
  computeFundedPropSlUsd,
  maxBufferForPropSlPoints,
  validateHedgePlanInput,
  type HedgePlanInput,
  type HedgePlanResult,
} from "@/models/trade-log/hedge-planner";
import { useTradingStore } from "@/models/trade-log/store";
import type { Challenge, PhasePlan, PhasePlanCreateInput, TradeDirection } from "@/models/trade-log/types";
import { HedgeTradeTicket } from "./hedge-trade-ticket";

type Props = {
  challenge: Challenge;
  plans: PhasePlan[];
  onSavePlan?: (plan: PhasePlanCreateInput) => void;
  onOpenLogDialog?: (prefill: {
    // Basic trade info
    symbol?: string;
    direction?: TradeDirection;
    size?: number;
    tpPrice?: number | null;
    slPrice?: number | null;
    personalPnl?: number;
    
    // Enhanced hedge context
    propContracts?: number;
    propDirection?: TradeDirection;
    propTpUsd?: number;
    propSlUsd?: number;
    propTpPoints?: number;
    propSlPoints?: number;
    personalTpPoints?: number;
    personalSlPoints?: number;
    hedgeTarget?: number;
    buffer?: number;
    personalLossUsd?: number;
  }) => void;
};

function qNum(s: string): number | undefined {
  if (!s || s.trim() === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export function ChallengePhasePlanner({ 
  challenge, 
  plans, 
  onSavePlan, 
  onOpenLogDialog 
}: Props) {
  const { trades, pairs } = useTradingStore(
    useShallow((s) => ({ trades: s.trades, pairs: s.pairs }))
  );

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fundedSlOpen, setFundedSlOpen] = useState(false);
  const [fundedBalance, setFundedBalance] = useState("");

  const isFundedPhase =
    challenge.status === "funded" || challenge.status === "passed";

  const fundedSlCalc = useMemo(() => {
    const balance = qNum(fundedBalance);
    if (balance === undefined) return null;
    return computeFundedPropSlUsd(balance);
  }, [fundedBalance]);

  // USD-based inputs only
  const [inputs, setInputs] = useState({
    propTpUsd: "",
    propSlUsd: "",
    propContracts: "2",
    personalTargetProfit: String(challenge.fee),
    bufferPropSl: "1.5",
    bufferPropTp: "1.5",
    bufferPersonalTp: "0",
    bufferPersonalSl: "0",
  });

  const LOT_STEP = 0.1;
  const MIN_LOT = 0.1;

  const nextPhaseNumber = useMemo(
    () => getPairsByChallengeId(challenge.id, trades, pairs).length + 1,
    [challenge.id, trades, pairs]
  );

  const buildHedgeInputPartial = useMemo(() => {
    const propTpUsd = qNum(inputs.propTpUsd);
    const propSlFromInput = qNum(inputs.propSlUsd);
    const propSlUsd =
      fundedSlOpen && fundedSlCalc && fundedSlCalc.propSlUsd > 0
        ? fundedSlCalc.propSlUsd
        : propSlFromInput;
    const contracts = qNum(inputs.propContracts) || 2;
    const personalTargetProfit =
      qNum(inputs.personalTargetProfit) ?? Math.max(challenge.fee, 1);
    const bufferPropSl = qNum(inputs.bufferPropSl) ?? 0.5;
    const bufferPropTp = qNum(inputs.bufferPropTp) ?? 0.5;
    const bufferPersonalTp = qNum(inputs.bufferPersonalTp) ?? 0;
    const bufferPersonalSl = qNum(inputs.bufferPersonalSl) ?? 0;

    if (propTpUsd === undefined || propSlUsd === undefined) return null;
    if (propTpUsd <= 0 || propSlUsd <= 0) return null;

    return {
      propTpUsd,
      propSlUsd,
      propContracts: contracts,
      personalTargetProfit,
      personalPointValue: 1,
      buffer: bufferPropSl,
      bufferPropSl,
      bufferPropTp,
      bufferPersonalTp,
      bufferPersonalSl,
      lotStep: LOT_STEP,
      minLot: MIN_LOT,
      challengeFee: challenge.fee,
      expectedPayout: 1800,
    } satisfies HedgePlanInput;
  }, [inputs, challenge.fee, fundedSlOpen, fundedSlCalc]);

  // Convert to HedgePlanInput with USD-based inputs
  const hedgeInput = useMemo((): HedgePlanInput | null => {
    if (!buildHedgeInputPartial) return null;
    const validation = validateHedgePlanInput(buildHedgeInputPartial);
    return validation.isValid ? buildHedgeInputPartial : null;
  }, [buildHedgeInputPartial]);

  const validationErrors = useMemo(() => {
    if (!buildHedgeInputPartial) return [];
    return validateHedgePlanInput(buildHedgeInputPartial).errors;
  }, [buildHedgeInputPartial]);

  // Calculate results - this updates immediately when contracts change
  const results = useMemo((): { result: HedgePlanResult | null; error: string | null } => {
    if (!hedgeInput) {
      return { result: null, error: null };
    }
    
    try {
      const result = computeHedgeResults(hedgeInput);
      return { result, error: null };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Calculation failed";
      return { result: null, error: errorMsg };
    }
  }, [hedgeInput]);

  const calculationResult = results.result;
  const calculationError = results.error;

  const maxBufferHint = useMemo(() => {
    const propSlFromInput = qNum(inputs.propSlUsd);
    const propSlUsd =
      fundedSlOpen && fundedSlCalc && fundedSlCalc.propSlUsd > 0
        ? fundedSlCalc.propSlUsd
        : propSlFromInput;
    const contracts = qNum(inputs.propContracts) || 2;
    if (propSlUsd === undefined || propSlUsd <= 0 || contracts <= 0) return null;

    const propSlPoints = propSlUsd / (contracts * 20);
    const maxBuffer = maxBufferForPropSlPoints(propSlPoints);
    return { propSlPoints, maxBuffer };
  }, [inputs.propSlUsd, inputs.propContracts, fundedSlOpen, fundedSlCalc]);

  const bufferWasClamped =
    calculationResult != null &&
    hedgeInput != null &&
    Math.abs(
      hedgeInput.bufferPropSl +
        hedgeInput.bufferPersonalTp -
        (calculationResult.effectiveBuffers.bufferPropSl +
          calculationResult.effectiveBuffers.bufferPersonalTp)
    ) > 1e-9;

  const updateInput = (field: string, value: string) => {
    setInputs(prev => ({ ...prev, [field]: value }));
    setSubmitError(null);
  };

  const handleSavePlan = () => {
    if (!hedgeInput || !results || !onSavePlan) return;

    try {
      const planData: PhasePlanCreateInput = {
        challengeId: challenge.id,
        phaseNumber: nextPhaseNumber,
        propTpUsd: hedgeInput.propTpUsd,
        propSlUsd: hedgeInput.propSlUsd,
        propContracts: hedgeInput.propContracts,
        personalTargetProfit: hedgeInput.personalTargetProfit,
        personalPointValue: hedgeInput.personalPointValue,
        buffer: hedgeInput.bufferPropSl,
        bufferPropSl: hedgeInput.bufferPropSl,
        bufferPropTp: hedgeInput.bufferPropTp,
        bufferPersonalTp: hedgeInput.bufferPersonalTp,
        bufferPersonalSl: hedgeInput.bufferPersonalSl,
        lotStep: hedgeInput.lotStep,
        minLot: hedgeInput.minLot,
        roundMode: "up" as const,
        expectedPayout: hedgeInput.expectedPayout,
        propSymbol: "ES",
        personalSymbol: "ES",
        personalEntryPrice: null, // Will be set at execution
        hedgePairId: null,
        status: "planned" as const
      };

      onSavePlan(planData);
      setSubmitError(null);
    } catch (error) {
      console.error("Save error:", error);
      setSubmitError(`Save failed: ${error}`);
    }
  };

  const handleLogAsPhase = () => {
    if (!hedgeInput || !calculationResult || !onOpenLogDialog) return;

    // Calculate personal win/loss amounts for context
    const personalWinUsd = calculationResult.personalTpPoints * calculationResult.roundedLots * hedgeInput.personalPointValue;
    const personalLossUsd = calculationResult.personalSlPoints * calculationResult.roundedLots * hedgeInput.personalPointValue;

    // Calculate reasonable entry price from USD amounts and points
    const estimatedEntryPrice = calculationResult.propDirection === "long" 
      ? calculationResult.propTpUsd / hedgeInput.propContracts / 20 - calculationResult.propTpPoints
      : calculationResult.propTpUsd / hedgeInput.propContracts / 20 + calculationResult.propTpPoints;

    // Complete hedge setup prefill data
    const completePrefillData = {
      // Basic trade info
      symbol: "ES",
      direction: calculationResult.personalDirection,
      size: calculationResult.roundedLots,
      
      // Calculated entry price for price calculations
      entryPrice: Math.round(estimatedEntryPrice * 100) / 100, // Round to 2 decimals
      
      // Expected amounts for validation
      personalPnl: personalWinUsd,
      propPnl: calculationResult.propTpUsd, // Expected prop side profit
      
      // Additional hedge context
      propContracts: hedgeInput.propContracts,
      propDirection: calculationResult.propDirection,
      propTpUsd: calculationResult.propTpUsd,
      propSlUsd: calculationResult.propSlUsd,
      propTpPoints: calculationResult.propTpPoints,
      propSlPoints: calculationResult.propSlPoints,
      personalTpPoints: calculationResult.personalTpPoints,
      personalSlPoints: calculationResult.personalSlPoints,
      hedgeTarget: hedgeInput.personalTargetProfit,
      buffer: hedgeInput.bufferPropSl,
      personalLossUsd: personalLossUsd,
      hedgePlanId: null, // Live planner - no saved plan ID
    };

    onOpenLogDialog(completePrefillData);
  };

  return (
    <div className="space-y-6">
      {/* Main Layout: Strict Two-Column */}
      <div className="grid grid-cols-2 gap-8 max-w-6xl mx-auto">
        
        {/* LEFT: Trade Inputs */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Trade Inputs</CardTitle>
            <div className="text-sm text-muted-foreground">
              Phase {nextPhaseNumber}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Prop Trade Inputs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-blue-600">Prop Side</h3>
                {isFundedPhase && (
                  <Button
                    type="button"
                    variant={fundedSlOpen ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs shrink-0"
                    onClick={() => setFundedSlOpen((open) => !open)}
                  >
                    Funded SL
                  </Button>
                )}
              </div>

              {fundedSlOpen && isFundedPhase && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-2">
                  <Label htmlFor="fundedBalance" className="text-xs font-medium">
                    Funded balance
                  </Label>
                  <Input
                    id="fundedBalance"
                    type="number"
                    value={fundedBalance}
                    onChange={(e) => setFundedBalance(e.target.value)}
                    placeholder={String(challenge.balance || 50100)}
                    className="font-mono"
                  />
                  {fundedSlCalc && fundedSlCalc.propSlUsd > 0 ? (
                    <div className="text-xs space-y-1">
                      <div className="text-muted-foreground">{fundedSlCalc.ruleLabel}</div>
                      <div className="font-mono font-medium text-red-700">
                        Prop SL USD: {formatMoney(fundedSlCalc.propSlUsd)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      Below 50,100 → $2,000 SL · Above 50,100 → balance − 50,100
                    </div>
                  )}
                </div>
              )}

              {/* Compact prop inputs in one row */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="propTpUsd" className="text-xs font-medium">TP</Label>
                  <Input
                    id="propTpUsd"
                    type="number"
                    value={inputs.propTpUsd}
                    onChange={(e) => updateInput("propTpUsd", e.target.value)}
                    placeholder="1000"
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label htmlFor="propSlUsd" className="text-xs font-medium">SL</Label>
                  <Input
                    id="propSlUsd"
                    type="number"
                    value={
                      fundedSlOpen && fundedSlCalc && fundedSlCalc.propSlUsd > 0
                        ? String(fundedSlCalc.propSlUsd)
                        : inputs.propSlUsd
                    }
                    onChange={(e) => updateInput("propSlUsd", e.target.value)}
                    placeholder="1000"
                    className="font-mono"
                    readOnly={fundedSlOpen && !!fundedSlCalc && fundedSlCalc.propSlUsd > 0}
                  />
                </div>
                <div>
                  <Label htmlFor="propContracts" className="text-xs font-medium">Contracts</Label>
                  <Input
                    id="propContracts"
                    type="number"
                    value={inputs.propContracts}
                    onChange={(e) => updateInput("propContracts", e.target.value)}
                    placeholder="2"
                    className="font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Hedge Target */}
            <div>
              <Label htmlFor="personalTargetProfit" className="text-xs font-medium">Hedge Target USD</Label>
              <Input
                id="personalTargetProfit"
                type="number"
                value={inputs.personalTargetProfit}
                onChange={(e) => updateInput("personalTargetProfit", e.target.value)}
                placeholder={String(challenge.fee)}
                className="font-mono"
              />
            </div>
            
            {/* Buffers — prop SL↔personal TP and prop TP↔personal SL */}
            <div className="space-y-3 rounded-lg border border-border/60 p-3">
              <div className="text-xs font-medium text-muted-foreground">Buffers (points)</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-blue-600">Prop account</div>
                  <div>
                    <Label htmlFor="bufferPropSl" className="text-xs">SL → personal TP</Label>
                    <Input
                      id="bufferPropSl"
                      type="number"
                      step="0.1"
                      value={inputs.bufferPropSl}
                      onChange={(e) => updateInput("bufferPropSl", e.target.value)}
                      className="font-mono"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bufferPropTp" className="text-xs">TP → personal SL</Label>
                    <Input
                      id="bufferPropTp"
                      type="number"
                      step="0.1"
                      value={inputs.bufferPropTp}
                      onChange={(e) => updateInput("bufferPropTp", e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-green-600">Personal hedge</div>
                  <div>
                    <Label htmlFor="bufferPersonalTp" className="text-xs">TP offset</Label>
                    <Input
                      id="bufferPersonalTp"
                      type="number"
                      step="0.1"
                      value={inputs.bufferPersonalTp}
                      onChange={(e) => updateInput("bufferPersonalTp", e.target.value)}
                      className="font-mono"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bufferPersonalSl" className="text-xs">SL offset</Label>
                    <Input
                      id="bufferPersonalSl"
                      type="number"
                      step="0.1"
                      value={inputs.bufferPersonalSl}
                      onChange={(e) => updateInput("bufferPersonalSl", e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </div>
              </div>
              {maxBufferHint && maxBufferHint.maxBuffer > 0 ? (
                <div className="text-xs text-muted-foreground">
                  Max combined TP-side gap: {maxBufferHint.maxBuffer.toFixed(1)} pts (prop SL + personal TP buffers)
                </div>
              ) : null}
              {bufferWasClamped && calculationResult ? (
                <div className="text-xs text-amber-700">
                  TP-side buffers scaled to fit prop SL (total{" "}
                  {(
                    calculationResult.effectiveBuffers.bufferPropSl +
                    calculationResult.effectiveBuffers.bufferPersonalTp
                  ).toFixed(1)}{" "}
                  pts)
                </div>
              ) : null}
              {calculationError ? (
                <div className="text-xs text-red-600">{calculationError}</div>
              ) : null}
            </div>

            <div className="text-xs text-muted-foreground">
              Fixed: $20/point per contract, $1/point per lot • Fee: {formatMoney(challenge.fee)}
            </div>
          </CardContent>
        </Card>

        {/* RIGHT: Trade Ticket */}
        {calculationResult && hedgeInput && (
          <HedgeTradeTicket 
            results={calculationResult} 
            inputs={hedgeInput} 
            challenge={challenge} 
          />
        )}
        
        {/* Empty state when no results */}
        {!calculationResult && (
          <Card className="border-dashed border-muted-foreground/25">
            <CardContent className="flex items-center justify-center h-64">
              <div className="text-center">
                {calculationError ? (
                  <div className="text-red-600">
                    <div className="text-lg font-medium mb-2">⚠ Calculation Error</div>
                    <div className="text-sm mb-4 max-w-md">{calculationError}</div>
                    <div className="text-xs text-muted-foreground">
                      Adjust your inputs above to fix this issue
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    <div className="text-lg font-medium">Trade Setup</div>
                    <div className="text-sm mt-1">Enter TP and SL USD amounts to calculate your hedge</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Simple Bottom Summary */}
      {calculationResult && hedgeInput && (
        <div className="border-t bg-muted/10 px-6 py-3">
          <div className="flex items-center justify-center gap-8 text-sm">
            <div className="text-center">
              <div className="font-medium text-green-600">
                {formatMoney(calculationResult.failScenario.hedgeProfitAfterFee)}
              </div>
              <div className="text-xs text-muted-foreground">Profit if prop fails</div>
            </div>
            
            <div className="text-center">
              <div className="font-medium text-red-600">
                {formatMoney(Math.abs(calculationResult.passScenario.downBeforePayout))}
              </div>
              <div className="text-xs text-muted-foreground">Loss if prop passes</div>
            </div>
          </div>
        </div>
      )}

      {/* Input Validation */}
      {!results && validationErrors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <div className="font-medium mb-1">Fix these to see results:</div>
          <ul className="list-disc pl-4 space-y-0.5">
            {validationErrors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {!results && validationErrors.length === 0 && (
        <div className="text-center text-muted-foreground p-4">
          Enter prop TP USD and SL USD to see calculations
        </div>
      )}

      {/* Error Display */}
      {submitError && (
        <div className="text-sm text-red-600 p-3 bg-red-50 rounded border border-red-200">
          {submitError}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button 
          variant="outline" 
          onClick={handleSavePlan}
          disabled={!calculationResult || !onSavePlan}
        >
          Save Plan
        </Button>
        <Button 
          size="lg"
          onClick={handleLogAsPhase}
          disabled={!calculationResult || !onOpenLogDialog}
          className="px-8"
        >
          Log Trade
        </Button>
      </div>
    </div>
  );
}