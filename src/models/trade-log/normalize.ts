import { normalizeLedgerPhases } from "./challenge-ledger";
import type { Challenge, HedgePair, Identity, LogSession, LogTrade, PhasePlan } from "./types";

function nowIso() {
  return new Date().toISOString();
}

export function normalizeIdentity(row: unknown): Identity | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string") return null;
  const iso = nowIso();
  return {
    id: r.id,
    name: r.name,
    note: r.note != null ? String(r.note) : "",
    createdAt: r.createdAt != null ? String(r.createdAt) : iso,
    updatedAt: r.updatedAt != null ? String(r.updatedAt) : iso,
  };
}

export function normalizeChallenge(row: unknown): Challenge | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string") return null;

  const st = r.status;
  const status: Challenge["status"] =
    st === "evaluation" ||
    st === "passed" ||
    st === "failed" ||
    st === "funded" ||
    st === "paid_out" ||
    st === "archived"
      ? st
      : "evaluation";

  const iso = nowIso();
  const payoutRaw = r.payoutAmount;
  const payoutAmount =
    payoutRaw != null && payoutRaw !== "" && Number.isFinite(Number(payoutRaw))
      ? Number(payoutRaw)
      : null;
  const payoutAtRaw = r.payoutAt;
  const payoutAt =
    payoutAtRaw != null && String(payoutAtRaw).trim() !== ""
      ? String(payoutAtRaw)
      : null;

  const disbRaw = r.disbursementAt;
  const disbursementAt =
    disbRaw != null && String(disbRaw).trim() !== ""
      ? String(disbRaw)
      : null;

  const identityRaw = r.identityId;
  const identityId =
    identityRaw != null && String(identityRaw).trim() !== ""
      ? String(identityRaw)
      : "";

  return {
    id: r.id,
    identityId,
    name: r.name,
    fee: Number(r.fee) || 0,
    balance: Number(r.balance) || 0,
    currentProfitTarget: Number(r.currentProfitTarget) || 0,
    maxDrawdown: Number(r.maxDrawdown) || 0,
    dailyLossCap: Number(r.dailyLossCap) || 0,
    status,
    note: r.note != null ? String(r.note) : "",
    payoutAmount,
    payoutAt,
    disbursementAt,
    ledgerPhases: normalizeLedgerPhases(r.ledgerPhases),
    createdAt: r.createdAt != null ? String(r.createdAt) : iso,
    updatedAt: r.updatedAt != null ? String(r.updatedAt) : iso,
  };
}

/** Drop legacy journal rows and partial objects. */
export function normalizeTrade(row: unknown): LogTrade | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if ("accountId" in r) return null;
  if (typeof r.symbol !== "string" || typeof r.id !== "string") return null;
  if (r.direction !== "long" && r.direction !== "short") return null;

  const challengeRaw = r.challengeId;
  const challengeId =
    challengeRaw != null && challengeRaw !== ""
      ? String(challengeRaw)
      : null;

  const ti = r.identityId;
  const identityId =
    ti != null && String(ti).trim() !== "" ? String(ti) : "";

  const iso = nowIso();
  return {
    id: r.id,
    identityId,
    challengeId,
    sessionId:
      r.sessionId == null || r.sessionId === ""
        ? null
        : String(r.sessionId),
    symbol: r.symbol,
    direction: r.direction,
    size: Number(r.size) || 0,
    entryPrice: Number(r.entryPrice) || 0,
    exitPrice:
      r.exitPrice != null && r.exitPrice !== ""
        ? Number(r.exitPrice)
        : null,
    currentPrice:
      r.currentPrice != null && r.currentPrice !== ""
        ? Number(r.currentPrice)
        : null,
    stopLoss:
      r.stopLoss != null && r.stopLoss !== ""
        ? Number(r.stopLoss)
        : null,
    takeProfit:
      r.takeProfit != null && r.takeProfit !== ""
        ? Number(r.takeProfit)
        : null,
    fees: Number(r.fees) || 0,
    directPnl:
      r.directPnl != null && r.directPnl !== "" && Number.isFinite(Number(r.directPnl))
        ? Number(r.directPnl)
        : null,
    notes: r.notes != null ? String(r.notes) : "",
    screenshot:
      r.screenshot != null && String(r.screenshot) !== ""
        ? String(r.screenshot)
        : null,
    createdAt: r.createdAt != null ? String(r.createdAt) : iso,
    updatedAt: r.updatedAt != null ? String(r.updatedAt) : iso,
  };
}

export function normalizeSession(row: unknown): LogSession | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.closed !== "boolean") return null;
  if (typeof r.id !== "string" || typeof r.date !== "string") return null;

  const iso = nowIso();
  return {
    id: r.id,
    date: r.date,
    notes: r.notes != null ? String(r.notes) : "",
    closed: r.closed,
    createdAt: r.createdAt != null ? String(r.createdAt) : iso,
    updatedAt: r.updatedAt != null ? String(r.updatedAt) : iso,
  };
}

export function normalizePair(row: unknown): HedgePair | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if ("challengeTradeId" in r) return null;
  if (typeof r.id !== "string") return null;
  if (typeof r.propTradeId !== "string") return null;
  if (typeof r.personalTradeId !== "string") return null;

  const st = r.status;
  const status: HedgePair["status"] =
    st === "open" ||
    st === "profitable" ||
    st === "loss" ||
    st === "break-even" ||
    st === "invalid"
      ? st
      : "open";

  const iso = nowIso();
  const phaseRaw = r.phaseNumber;
  const phaseNumber =
    phaseRaw != null && Number.isFinite(Number(phaseRaw))
      ? Math.max(1, Math.floor(Number(phaseRaw)))
      : 1;

  const planIdRaw = r.planId;
  const planId =
    planIdRaw != null && String(planIdRaw).trim() !== ""
      ? String(planIdRaw)
      : null;

  return {
    id: r.id,
    phaseNumber,
    propTradeId: String(r.propTradeId),
    personalTradeId: String(r.personalTradeId),
    combinedPnl: Number(r.combinedPnl) || 0,
    status,
    manuallySetStatus: Boolean(r.manuallySetStatus),
    planId,
    createdAt: r.createdAt != null ? String(r.createdAt) : iso,
    updatedAt: r.updatedAt != null ? String(r.updatedAt) : iso,
  };
}

export function normalizePlan(row: unknown): PhasePlan | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string") return null;
  if (typeof r.challengeId !== "string") return null;
  if (typeof r.propSymbol !== "string") return null;

  const st = r.status;
  const status: PhasePlan["status"] =
    st === "planned" || st === "open" || st === "closed" ? st : "planned";

  const roundMode: PhasePlan["roundMode"] =
    r.roundMode === "nearest" ? "nearest" : "up";

  const iso = nowIso();
  const phaseRaw = r.phaseNumber;
  const phaseNumber =
    phaseRaw != null && Number.isFinite(Number(phaseRaw))
      ? Math.max(1, Math.floor(Number(phaseRaw)))
      : 1;

  const hedgePairIdRaw = r.hedgePairId;
  const hedgePairId =
    hedgePairIdRaw != null && String(hedgePairIdRaw).trim() !== ""
      ? String(hedgePairIdRaw)
      : null;

  const personalEntryPriceRaw = r.personalEntryPrice;
  const personalEntryPrice =
    personalEntryPriceRaw != null && personalEntryPriceRaw !== "" && Number.isFinite(Number(personalEntryPriceRaw))
      ? Number(personalEntryPriceRaw)
      : null;

  // Handle both old (points-based) and new (USD-based) models
  let propTpUsd = Number(r.propTpUsd) || 0;
  let propSlUsd = Number(r.propSlUsd) || 0;
  
  // Migration: Convert old points-based data to USD if needed
  if (propTpUsd === 0 && propSlUsd === 0) {
    const oldTpPoints = Number(r.propTpPoints) || 0;
    const oldSlPoints = Number(r.propSlPoints) || 0;
    const contracts = Number(r.propContracts) || 1;
    const USD_PER_POINT_PER_CONTRACT = 20;
    
    if (oldTpPoints > 0 && oldSlPoints > 0) {
      propTpUsd = oldTpPoints * contracts * USD_PER_POINT_PER_CONTRACT;
      propSlUsd = oldSlPoints * contracts * USD_PER_POINT_PER_CONTRACT;
    }
  }

  // Handle both old and new field names for personal target
  const personalTargetProfit = Number(r.personalTargetProfit) || Number(r.targetProfit) || 0;

  return {
    id: r.id,
    challengeId: r.challengeId,
    phaseNumber,
    propTpUsd,
    propSlUsd,
    propContracts: Number(r.propContracts) || 1,
    personalTargetProfit,
    personalPointValue: Number(r.personalPointValue) || 1,
    buffer: Number(r.buffer) || 1.5,
    lotStep: Number(r.lotStep) || 0.1,
    minLot: Number(r.minLot) || 0.1,
    roundMode,
    expectedPayout: Number(r.expectedPayout) || 0,
    propSymbol: r.propSymbol,
    personalSymbol: r.personalSymbol != null ? String(r.personalSymbol) : r.propSymbol,
    personalEntryPrice,
    hedgePairId,
    status,
    createdAt: r.createdAt != null ? String(r.createdAt) : iso,
    updatedAt: r.updatedAt != null ? String(r.updatedAt) : iso,
  };
}
