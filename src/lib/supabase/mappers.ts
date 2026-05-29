/**
 * Map between app camelCase types and Supabase snake_case columns.
 */

import type {
  Challenge,
  HedgePair,
  Identity,
  LogSession,
  LogTrade,
  PhasePlan,
} from "@/models/trade-log/types";

type DbRow = Record<string, unknown>;

export function identityFromDb(row: DbRow): Identity {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    note: String(row.note ?? ""),
    createdAt: String(row.created_at ?? row.createdAt),
    updatedAt: String(row.updated_at ?? row.updatedAt),
  };
}

export function identityToDb(identity: Identity, userId?: string): DbRow {
  return {
    id: identity.id,
    ...(userId ? { user_id: userId } : {}),
    name: identity.name,
    note: identity.note,
    created_at: identity.createdAt,
    updated_at: identity.updatedAt,
  };
}

export function sessionFromDb(row: DbRow): LogSession {
  return {
    id: String(row.id),
    date: String(row.date),
    notes: String(row.notes ?? ""),
    closed: Boolean(row.closed),
    createdAt: String(row.created_at ?? row.createdAt),
    updatedAt: String(row.updated_at ?? row.updatedAt),
  };
}

export function sessionToDb(session: LogSession, userId?: string): DbRow {
  return {
    id: session.id,
    ...(userId ? { user_id: userId } : {}),
    date: session.date,
    notes: session.notes,
    closed: session.closed,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
  };
}

export function challengeFromDb(row: DbRow): Challenge {
  return {
    id: String(row.id),
    identityId: String(row.identity_id ?? row.identityId),
    name: String(row.name ?? ""),
    fee: Number(row.fee ?? 0),
    balance: Number(row.balance ?? 0),
    currentProfitTarget: Number(row.current_profit_target ?? row.currentProfitTarget ?? 0),
    maxDrawdown: Number(row.max_drawdown ?? row.maxDrawdown ?? 0),
    dailyLossCap: Number(row.daily_loss_cap ?? row.dailyLossCap ?? 0),
    status: row.status as Challenge["status"],
    note: String(row.note ?? ""),
    payoutAmount:
      row.payout_amount != null || row.payoutAmount != null
        ? Number(row.payout_amount ?? row.payoutAmount)
        : null,
    payoutAt:
      row.payout_at != null || row.payoutAt != null
        ? String(row.payout_at ?? row.payoutAt)
        : null,
    disbursementAt:
      row.disbursement_at != null || row.disbursementAt != null
        ? String(row.disbursement_at ?? row.disbursementAt)
        : null,
    ledgerPhases: (row.ledger_phases ?? row.ledgerPhases ?? []) as Challenge["ledgerPhases"],
    createdAt: String(row.created_at ?? row.createdAt),
    updatedAt: String(row.updated_at ?? row.updatedAt),
  };
}

export function challengeToDb(challenge: Challenge, userId?: string): DbRow {
  return {
    id: challenge.id,
    ...(userId ? { user_id: userId } : {}),
    identity_id: challenge.identityId,
    name: challenge.name,
    fee: challenge.fee,
    balance: challenge.balance,
    current_profit_target: challenge.currentProfitTarget,
    max_drawdown: challenge.maxDrawdown,
    daily_loss_cap: challenge.dailyLossCap,
    status: challenge.status,
    note: challenge.note,
    payout_amount: challenge.payoutAmount,
    payout_at: challenge.payoutAt,
    disbursement_at: challenge.disbursementAt,
    ledger_phases: challenge.ledgerPhases,
    created_at: challenge.createdAt,
    updated_at: challenge.updatedAt,
  };
}

export function tradeFromDb(row: DbRow): LogTrade {
  return {
    id: String(row.id),
    identityId: String(row.identity_id ?? row.identityId),
    challengeId:
      row.challenge_id != null || row.challengeId != null
        ? String(row.challenge_id ?? row.challengeId)
        : null,
    sessionId:
      row.session_id != null || row.sessionId != null
        ? String(row.session_id ?? row.sessionId)
        : null,
    symbol: String(row.symbol ?? ""),
    direction: row.direction as LogTrade["direction"],
    size: Number(row.size ?? 0),
    entryPrice: Number(row.entry_price ?? row.entryPrice ?? 0),
    exitPrice:
      row.exit_price != null || row.exitPrice != null
        ? Number(row.exit_price ?? row.exitPrice)
        : null,
    directPnl:
      row.direct_pnl != null || row.directPnl != null
        ? Number(row.direct_pnl ?? row.directPnl)
        : null,
    currentPrice:
      row.current_price != null || row.currentPrice != null
        ? Number(row.current_price ?? row.currentPrice)
        : null,
    stopLoss:
      row.stop_loss != null || row.stopLoss != null
        ? Number(row.stop_loss ?? row.stopLoss)
        : null,
    takeProfit:
      row.take_profit != null || row.takeProfit != null
        ? Number(row.take_profit ?? row.takeProfit)
        : null,
    fees: Number(row.fees ?? 0),
    notes: String(row.notes ?? ""),
    screenshot: row.screenshot != null ? String(row.screenshot) : null,
    plannedPnl:
      row.planned_pnl != null || row.plannedPnl != null
        ? Number(row.planned_pnl ?? row.plannedPnl)
        : undefined,
    actualPnl:
      row.actual_pnl != null || row.actualPnl != null
        ? Number(row.actual_pnl ?? row.actualPnl)
        : undefined,
    plannedTpPoints:
      row.planned_tp_points != null || row.plannedTpPoints != null
        ? Number(row.planned_tp_points ?? row.plannedTpPoints)
        : undefined,
    plannedSlPoints:
      row.planned_sl_points != null || row.plannedSlPoints != null
        ? Number(row.planned_sl_points ?? row.plannedSlPoints)
        : undefined,
    hedgePlanId:
      row.hedge_plan_id != null || row.hedgePlanId != null
        ? String(row.hedge_plan_id ?? row.hedgePlanId)
        : undefined,
    performanceVariance:
      row.performance_variance != null || row.performanceVariance != null
        ? Number(row.performance_variance ?? row.performanceVariance)
        : undefined,
    createdAt: String(row.created_at ?? row.createdAt),
    updatedAt: String(row.updated_at ?? row.updatedAt),
  };
}

export function tradeToDb(trade: LogTrade, userId?: string): DbRow {
  return {
    id: trade.id,
    ...(userId ? { user_id: userId } : {}),
    identity_id: trade.identityId,
    challenge_id: trade.challengeId,
    session_id: trade.sessionId,
    symbol: trade.symbol,
    direction: trade.direction,
    size: trade.size,
    entry_price: trade.entryPrice,
    exit_price: trade.exitPrice,
    direct_pnl: trade.directPnl,
    current_price: trade.currentPrice,
    stop_loss: trade.stopLoss,
    take_profit: trade.takeProfit,
    fees: trade.fees,
    notes: trade.notes,
    screenshot: trade.screenshot,
    planned_pnl: trade.plannedPnl ?? null,
    actual_pnl: trade.actualPnl ?? null,
    planned_tp_points: trade.plannedTpPoints ?? null,
    planned_sl_points: trade.plannedSlPoints ?? null,
    hedge_plan_id: trade.hedgePlanId ?? null,
    performance_variance: trade.performanceVariance ?? null,
    created_at: trade.createdAt,
    updated_at: trade.updatedAt,
  };
}

export function hedgePairFromDb(row: DbRow): HedgePair {
  return {
    id: String(row.id),
    phaseNumber: Number(row.phase_number ?? row.phaseNumber ?? 1),
    propTradeId: String(row.prop_trade_id ?? row.propTradeId),
    personalTradeId: String(row.personal_trade_id ?? row.personalTradeId),
    combinedPnl: Number(row.combined_pnl ?? row.combinedPnl ?? 0),
    status: row.status as HedgePair["status"],
    manuallySetStatus: Boolean(row.manually_set_status ?? row.manuallySetStatus),
    planId:
      row.plan_id != null || row.planId != null
        ? String(row.plan_id ?? row.planId)
        : null,
    createdAt: String(row.created_at ?? row.createdAt),
    updatedAt: String(row.updated_at ?? row.updatedAt),
  };
}

export function hedgePairToDb(pair: HedgePair, userId?: string): DbRow {
  return {
    id: pair.id,
    ...(userId ? { user_id: userId } : {}),
    phase_number: pair.phaseNumber,
    prop_trade_id: pair.propTradeId,
    personal_trade_id: pair.personalTradeId,
    combined_pnl: pair.combinedPnl,
    status: pair.status,
    manually_set_status: pair.manuallySetStatus,
    plan_id: pair.planId,
    created_at: pair.createdAt,
    updated_at: pair.updatedAt,
  };
}

export function phasePlanFromDb(row: DbRow): PhasePlan {
  return {
    id: String(row.id),
    challengeId: String(row.challenge_id ?? row.challengeId),
    phaseNumber: Number(row.phase_number ?? row.phaseNumber ?? 1),
    propTpUsd: Number(row.prop_tp_usd ?? row.propTpUsd ?? 0),
    propSlUsd: Number(row.prop_sl_usd ?? row.propSlUsd ?? 0),
    propContracts: Number(row.prop_contracts ?? row.propContracts ?? 0),
    personalTargetProfit: Number(row.personal_target_profit ?? row.personalTargetProfit ?? 0),
    personalPointValue: Number(row.personal_point_value ?? row.personalPointValue ?? 0),
    buffer: Number(row.buffer ?? 0),
    bufferPropSl: Number(row.buffer_prop_sl ?? row.bufferPropSl ?? 0),
    bufferPropTp: Number(row.buffer_prop_tp ?? row.bufferPropTp ?? 0),
    bufferPersonalTp: Number(row.buffer_personal_tp ?? row.bufferPersonalTp ?? 0),
    bufferPersonalSl: Number(row.buffer_personal_sl ?? row.bufferPersonalSl ?? 0),
    lotStep: Number(row.lot_step ?? row.lotStep ?? 0),
    minLot: Number(row.min_lot ?? row.minLot ?? 0),
    roundMode: (row.round_mode ?? row.roundMode) as PhasePlan["roundMode"],
    expectedPayout: Number(row.expected_payout ?? row.expectedPayout ?? 0),
    propSymbol: String(row.prop_symbol ?? row.propSymbol ?? ""),
    personalSymbol: String(row.personal_symbol ?? row.personalSymbol ?? ""),
    personalEntryPrice:
      row.personal_entry_price != null || row.personalEntryPrice != null
        ? Number(row.personal_entry_price ?? row.personalEntryPrice)
        : null,
    hedgePairId:
      row.hedge_pair_id != null || row.hedgePairId != null
        ? String(row.hedge_pair_id ?? row.hedgePairId)
        : null,
    status: row.status as PhasePlan["status"],
    createdAt: String(row.created_at ?? row.createdAt),
    updatedAt: String(row.updated_at ?? row.updatedAt),
  };
}

export function phasePlanToDb(plan: PhasePlan, userId?: string): DbRow {
  return {
    id: plan.id,
    ...(userId ? { user_id: userId } : {}),
    challenge_id: plan.challengeId,
    phase_number: plan.phaseNumber,
    prop_tp_usd: plan.propTpUsd,
    prop_sl_usd: plan.propSlUsd,
    prop_contracts: plan.propContracts,
    personal_target_profit: plan.personalTargetProfit,
    personal_point_value: plan.personalPointValue,
    buffer: plan.buffer,
    buffer_prop_sl: plan.bufferPropSl,
    buffer_prop_tp: plan.bufferPropTp,
    buffer_personal_tp: plan.bufferPersonalTp,
    buffer_personal_sl: plan.bufferPersonalSl,
    lot_step: plan.lotStep,
    min_lot: plan.minLot,
    round_mode: plan.roundMode,
    expected_payout: plan.expectedPayout,
    prop_symbol: plan.propSymbol,
    personal_symbol: plan.personalSymbol,
    personal_entry_price: plan.personalEntryPrice,
    hedge_pair_id: plan.hedgePairId,
    status: plan.status,
    created_at: plan.createdAt,
    updated_at: plan.updatedAt,
  };
}

export function patchToDb(patch: Record<string, unknown>): DbRow {
  const out: DbRow = {};
  const map: Record<string, string> = {
    identityId: "identity_id",
    challengeId: "challenge_id",
    sessionId: "session_id",
    entryPrice: "entry_price",
    exitPrice: "exit_price",
    directPnl: "direct_pnl",
    currentPrice: "current_price",
    stopLoss: "stop_loss",
    takeProfit: "take_profit",
    plannedPnl: "planned_pnl",
    actualPnl: "actual_pnl",
    plannedTpPoints: "planned_tp_points",
    plannedSlPoints: "planned_sl_points",
    hedgePlanId: "hedge_plan_id",
    performanceVariance: "performance_variance",
    createdAt: "created_at",
    updatedAt: "updated_at",
    currentProfitTarget: "current_profit_target",
    maxDrawdown: "max_drawdown",
    dailyLossCap: "daily_loss_cap",
    payoutAmount: "payout_amount",
    payoutAt: "payout_at",
    disbursementAt: "disbursement_at",
    ledgerPhases: "ledger_phases",
    phaseNumber: "phase_number",
    propTradeId: "prop_trade_id",
    personalTradeId: "personal_trade_id",
    combinedPnl: "combined_pnl",
    manuallySetStatus: "manually_set_status",
    planId: "plan_id",
    propTpUsd: "prop_tp_usd",
    propSlUsd: "prop_sl_usd",
    propContracts: "prop_contracts",
    personalTargetProfit: "personal_target_profit",
    personalPointValue: "personal_point_value",
    bufferPropSl: "buffer_prop_sl",
    bufferPropTp: "buffer_prop_tp",
    bufferPersonalTp: "buffer_personal_tp",
    bufferPersonalSl: "buffer_personal_sl",
    lotStep: "lot_step",
    minLot: "min_lot",
    roundMode: "round_mode",
    expectedPayout: "expected_payout",
    propSymbol: "prop_symbol",
    personalSymbol: "personal_symbol",
    personalEntryPrice: "personal_entry_price",
    hedgePairId: "hedge_pair_id",
  };

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    out[map[key] ?? key] = value;
  }
  return out;
}
