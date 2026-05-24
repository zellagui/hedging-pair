/**
 * LucidFlex hedge calculator — unified USD-based calculation engine for hedge planning.
 * 
 * This module provides a single, clear calculation path for all hedge planning needs.
 * Uses USD-based prop inputs with contract multiplier for consistent calculations.
 */

import type { TradeDirection } from "./types";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Each contract is worth $20 per point */
const USD_PER_POINT_PER_CONTRACT = 20;

// =============================================================================
// UNIFIED TYPES
// =============================================================================

/**
 * Unified input type for hedge calculations.
 * Uses USD-based prop inputs for consistent contract calculations.
 */
export type HedgePlanInput = {
  // Prop trade - USD based
  propTpUsd: number;
  propSlUsd: number;
  propContracts: number;
  
  // Personal hedge
  personalTargetProfit: number;
  personalPointValue: number;
  buffer: number;
  lotStep: number;
  minLot: number;
  
  // Challenge
  challengeFee: number;
  expectedPayout: number;
};

/**
 * Unified result type with all calculated values and explanations.
 */
export type HedgePlanResult = {
  // Auto-derived prop values
  propDirection: TradeDirection;
  propTpPoints: number;
  propSlPoints: number;
  propTpUsd: number;
  propSlUsd: number;
  
  // Personal values
  personalDirection: TradeDirection;
  personalTpPoints: number;
  personalSlPoints: number;
  rawLots: number;
  roundedLots: number;
  
  // Scenarios
  failScenario: { hedgeProfitAfterFee: number };
  passScenario: { downBeforePayout: number; netAfterPayout: number };
  breakevenPointsAtCurrentSize: number;
  
  // Formula explanations
  explanations: Record<string, string>;
};

/**
 * Input validation result
 */
export type ValidationResult = {
  isValid: boolean;
  errors: string[];
};

/** Funded account baseline — drawdown is measured from this balance */
export const FUNDED_BASELINE_BALANCE = 50_100;

/** Default max drawdown (USD) when funded balance is at or below baseline */
export const FUNDED_DEFAULT_DRAWDOWN_USD = 2_000;

/**
 * Prop SL USD from current funded balance.
 * Below baseline → fixed $2,000 drawdown; above baseline → balance − baseline.
 */
export function computeFundedPropSlUsd(fundedBalance: number): {
  propSlUsd: number;
  ruleLabel: string;
} {
  if (!Number.isFinite(fundedBalance) || fundedBalance <= 0) {
    return { propSlUsd: 0, ruleLabel: "Enter a valid funded balance" };
  }

  if (fundedBalance < FUNDED_BASELINE_BALANCE) {
    return {
      propSlUsd: FUNDED_DEFAULT_DRAWDOWN_USD,
      ruleLabel: `Balance below ${FUNDED_BASELINE_BALANCE.toLocaleString()} → ${FUNDED_DEFAULT_DRAWDOWN_USD.toLocaleString()} drawdown`,
    };
  }

  if (fundedBalance > FUNDED_BASELINE_BALANCE) {
    const propSlUsd = fundedBalance - FUNDED_BASELINE_BALANCE;
    return {
      propSlUsd,
      ruleLabel: `${fundedBalance.toLocaleString()} − ${FUNDED_BASELINE_BALANCE.toLocaleString()} = ${propSlUsd.toLocaleString()} SL`,
    };
  }

  return {
    propSlUsd: FUNDED_DEFAULT_DRAWDOWN_USD,
    ruleLabel: `At baseline → ${FUNDED_DEFAULT_DRAWDOWN_USD.toLocaleString()} drawdown`,
  };
}


export function validateHedgePlanInput(input: HedgePlanInput): ValidationResult {
  const errors: string[] = [];

  // Required USD fields
  if (!input.propTpUsd || input.propTpUsd <= 0) {
    errors.push("Prop TP USD is required and must be positive");
  }

  if (!input.propSlUsd || input.propSlUsd <= 0) {
    errors.push("Prop SL USD is required and must be positive");
  }

  if (!input.propContracts || input.propContracts <= 0) {
    errors.push("Prop contracts must be positive");
  }

  // Personal hedge fields
  if (input.personalTargetProfit <= 0) {
    errors.push("Personal target profit must be positive");
  }

  if (!input.personalPointValue || input.personalPointValue <= 0) {
    errors.push("Personal point value must be positive");
  }

  if (input.buffer < 0) {
    errors.push("Buffer cannot be negative");
  }

  if (!input.lotStep || input.lotStep <= 0) {
    errors.push("Lot step must be positive");
  }

  if (!input.minLot || input.minLot <= 0) {
    errors.push("Minimum lot must be positive");
  }

  // Challenge fields
  if (input.challengeFee < 0) {
    errors.push("Challenge fee cannot be negative");
  }

  if (!input.expectedPayout || input.expectedPayout <= 0) {
    errors.push("Expected payout must be positive");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// =============================================================================
// CORE CALCULATION FUNCTIONS
// =============================================================================

export function calculatePropSide(input: HedgePlanInput): {
  propDirection: TradeDirection;
  propTpPoints: number;
  propSlPoints: number;
  propTpUsd: number;
  propSlUsd: number;
} {
  // Calculate total USD per point based on contracts
  const totalUsdPerPoint = input.propContracts * USD_PER_POINT_PER_CONTRACT;
  
  // Convert USD to points using contract multiplier
  const propTpPoints = input.propTpUsd / totalUsdPerPoint;
  const propSlPoints = input.propSlUsd / totalUsdPerPoint;
  
  // Auto-detect direction from TP vs SL USD amounts
  const propDirection: TradeDirection = input.propTpUsd > input.propSlUsd ? "long" : "short";
  
  return {
    propDirection,
    propTpPoints,
    propSlPoints,
    propTpUsd: input.propTpUsd,
    propSlUsd: input.propSlUsd
  };
}

export function calculatePersonalSide(
  input: HedgePlanInput,
  propSide: ReturnType<typeof calculatePropSide>
): {
  personalDirection: TradeDirection;
  personalTpPoints: number;
  personalSlPoints: number;
  rawLots: number;
  roundedLots: number;
} {
  // Personal direction is always opposite
  const personalDirection: TradeDirection = propSide.propDirection === "long" ? "short" : "long";

  // Personal TP/SL from prop levels with buffer (default 1.5 pts)
  const personalTpPoints = propSide.propSlPoints - input.buffer;
  const personalSlPoints = propSide.propTpPoints + input.buffer;

  // Validate that personal points are positive
  if (personalSlPoints <= 0 || personalTpPoints <= 0) {
    // Provide more helpful error message with suggested fixes
    const minBufferForTp = propSide.propSlPoints - 0.1; // Leave at least 0.1 pts
    const suggestedBuffer = Math.min(input.buffer, minBufferForTp);
    throw new Error(
      `Buffer ${input.buffer} too large. Prop SL=${propSide.propSlPoints} pts would result in personal TP=${personalTpPoints} pts. ` +
      `Try buffer ≤ ${minBufferForTp.toFixed(1)} pts or increase prop SL USD.`
    );
  }

  // Calculate lot size using target profit and personal TP points
  const rawLots = input.personalTargetProfit / (personalTpPoints * input.personalPointValue);
  
  // Round UP to next allowed lot step, respecting minimum lot
  const roundedLots = Math.max(
    input.minLot, 
    Math.ceil(rawLots / input.lotStep) * input.lotStep
  );

  return {
    personalDirection,
    personalTpPoints,
    personalSlPoints,
    rawLots,
    roundedLots
  };
}

export function calculateScenarios(
  input: HedgePlanInput,
  propSide: ReturnType<typeof calculatePropSide>,
  personalSide: ReturnType<typeof calculatePersonalSide>
): {
  failScenario: { hedgeProfitAfterFee: number };
  passScenario: { downBeforePayout: number; netAfterPayout: number };
  breakevenPointsAtCurrentSize: number;
} {
  // If prop fails, personal hedge wins
  const personalWinPnl = personalSide.personalTpPoints * personalSide.roundedLots * input.personalPointValue;
  const hedgeProfitAfterFee = personalWinPnl - input.challengeFee;

  // If prop passes, personal hedge loses
  const personalLossPnl = personalSide.personalSlPoints * personalSide.roundedLots * input.personalPointValue;
  const downBeforePayout = personalLossPnl + input.challengeFee;
  const netAfterPayout = input.expectedPayout - downBeforePayout;

  // Break-even calculation
  const breakevenPointsAtCurrentSize = input.challengeFee / (personalSide.roundedLots * input.personalPointValue);

  return {
    failScenario: { hedgeProfitAfterFee },
    passScenario: { downBeforePayout, netAfterPayout },
    breakevenPointsAtCurrentSize
  };
}

export function generateExplanations(
  input: HedgePlanInput,
  propSide: ReturnType<typeof calculatePropSide>,
  personalSide: ReturnType<typeof calculatePersonalSide>,
  scenarios: ReturnType<typeof calculateScenarios>
): Record<string, string> {
  const totalUsdPerPoint = input.propContracts * USD_PER_POINT_PER_CONTRACT;
  
  return {
    propDirection: `${propSide.propDirection.toUpperCase()} (auto-detected from TP $${propSide.propTpUsd} vs SL $${propSide.propSlUsd})`,
    
    propTpPoints: `${propSide.propTpPoints.toFixed(1)} points ($${propSide.propTpUsd} ÷ ${input.propContracts} contracts ÷ $${USD_PER_POINT_PER_CONTRACT}/point)`,
    
    propSlPoints: `${propSide.propSlPoints.toFixed(1)} points ($${propSide.propSlUsd} ÷ ${input.propContracts} contracts ÷ $${USD_PER_POINT_PER_CONTRACT}/point)`,
    
    propTpUsd: `$${propSide.propTpUsd.toLocaleString()} (${propSide.propTpPoints.toFixed(1)} points × ${input.propContracts} contracts × $${USD_PER_POINT_PER_CONTRACT}/point)`,
    
    propSlUsd: `$${propSide.propSlUsd.toLocaleString()} loss (${propSide.propSlPoints.toFixed(1)} points × ${input.propContracts} contracts × $${USD_PER_POINT_PER_CONTRACT}/point)`,
    
    personalDirection: `${personalSide.personalDirection.toUpperCase()} (opposite of prop ${propSide.propDirection})`,
    
    personalTpPoints: `${personalSide.personalTpPoints.toFixed(1)} points (prop SL ${propSide.propSlPoints.toFixed(1)} - ${input.buffer} buffer)`,
    
    personalSlPoints: `${personalSide.personalSlPoints.toFixed(1)} points (prop TP ${propSide.propTpPoints.toFixed(1)} + ${input.buffer} buffer)`,
    
    rawLots: `${personalSide.rawLots.toFixed(3)} lots (target $${input.personalTargetProfit} ÷ (${personalSide.personalTpPoints.toFixed(1)} points × $${input.personalPointValue}/point/lot))`,
    
    roundedLots: `${personalSide.roundedLots.toFixed(2)} lots (rounded up to ${input.lotStep} step, min ${input.minLot})`,
    
    failScenario: `Hedge wins $${(personalSide.personalTpPoints * personalSide.roundedLots * input.personalPointValue).toLocaleString()}, minus $${input.challengeFee} fee = $${scenarios.failScenario.hedgeProfitAfterFee.toLocaleString()}`,
    
    passScenario: `Hedge loses $${(personalSide.personalSlPoints * personalSide.roundedLots * input.personalPointValue).toLocaleString()}, plus $${input.challengeFee} fee = $${scenarios.passScenario.downBeforePayout.toLocaleString()} down`,
    
    netAfterPayout: `Payout $${input.expectedPayout.toLocaleString()} minus losses $${scenarios.passScenario.downBeforePayout.toLocaleString()} = $${scenarios.passScenario.netAfterPayout.toLocaleString()}`,
    
    breakevenPoints: `$${input.challengeFee} fee ÷ (${personalSide.roundedLots.toFixed(2)} lots × $${input.personalPointValue}/point) = ${scenarios.breakevenPointsAtCurrentSize.toFixed(1)} points needed`
  };
}

// =============================================================================
// MAIN CALCULATION FUNCTION
// =============================================================================

/**
 * Main calculation function that orchestrates all hedge calculations.
 * This is the single entry point for all hedge planning calculations.
 */
export function computeHedgeResults(input: HedgePlanInput): HedgePlanResult {
  // 1. Validate inputs
  const validation = validateHedgePlanInput(input);
  if (!validation.isValid) {
    throw new Error(`Invalid input: ${validation.errors.join(", ")}`);
  }
  
  // 2. Calculate prop side
  const propSide = calculatePropSide(input);
  
  // 3. Calculate personal side  
  const personalSide = calculatePersonalSide(input, propSide);
  
  // 4. Calculate scenarios
  const scenarios = calculateScenarios(input, propSide, personalSide);
  
  // 5. Generate explanations
  const explanations = generateExplanations(input, propSide, personalSide, scenarios);
  
  return {
    ...propSide,
    ...personalSide,
    ...scenarios,
    explanations
  };
}
