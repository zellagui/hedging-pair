import type { Challenge, HedgePair, Identity, LogTrade } from "./types";

/** Overview / lists: scoped slice by identity. Assumes prop legs carry correct `identityId`. */
export function filterTradeLogSliceByIdentity<
  P extends HedgePair & { phaseNumber?: number },
>(
  trades: LogTrade[],
  challenges: Challenge[],
  pairs: P[],
  identityId: string
): {
  trades: LogTrade[];
  challenges: Challenge[];
  pairs: P[];
} {
  const tradesOut = trades.filter((t) => t.identityId === identityId);
  const challengesOut = challenges.filter((c) => c.identityId === identityId);
  const idSet = new Set(tradesOut.map((t) => t.id));
  const pairsOut = pairs.filter((p) => idSet.has(p.propTradeId));

  return { trades: tradesOut, challenges: challengesOut, pairs: pairsOut };
}

function newUuid() {
  return crypto.randomUUID();
}

/** Ensures ≥1 identity, backfills challenges/trades, syncs hedge personal legs — run after hydrate / backup import. */
export function ensureIdentityConsistency(input: {
  identities: Identity[];
  challenges: Challenge[];
  trades: LogTrade[];
  pairs: HedgePair[];
  activeIdentityId: string | null;
  nowIso: () => string;
}): {
  identities: Identity[];
  challenges: Challenge[];
  trades: LogTrade[];
  activeIdentityId: string | null;
  changed: boolean;
} {
  const nowIsoFn = input.nowIso;
  let identities = [...input.identities];
  let activeIdentityId = input.activeIdentityId;
  let changed = false;

  if (identities.length === 0) {
    const id = newUuid();
    const iso = nowIsoFn();
    identities = [
      {
        id,
        name: "Default workspace",
        note: "",
        createdAt: iso,
        updatedAt: iso,
      },
    ];
    changed = true;
  }

  const validIdSet = new Set(identities.map((x) => x.id));
  const fallbackId = identities[0]!.id;

  const challenges = input.challenges.map((c) => {
    const id =
      c.identityId.trim() !== "" && validIdSet.has(c.identityId)
        ? c.identityId
        : fallbackId;
    if (id !== c.identityId) {
      changed = true;
      return { ...c, identityId: id, updatedAt: nowIsoFn() };
    }
    return c;
  });

  const challengeIdToIdentity = new Map<string, string>(
    challenges.map((xc) => [xc.id, xc.identityId] as const)
  );

  const pairByPersonal = new Map<string, HedgePair>();
  for (const p of input.pairs) pairByPersonal.set(p.personalTradeId, p);

  const tradesByOrigId = new Map(input.trades.map((xt) => [xt.id, xt] as const));

  let tradesPatched = false;
  const trades = input.trades.map((t) => {
    let resolved: string;
    if (t.challengeId != null) {
      resolved = challengeIdToIdentity.get(t.challengeId) ?? fallbackId;
    } else {
      const pair = pairByPersonal.get(t.id);
      if (pair) {
        const prop = tradesByOrigId.get(pair.propTradeId);
        const pc = prop?.challengeId ?? null;
        if (pc != null) {
          resolved = challengeIdToIdentity.get(pc) ?? fallbackId;
        } else {
          resolved =
            prop != null &&
            prop.identityId.trim() !== "" &&
            validIdSet.has(prop.identityId)
              ? prop.identityId
              : fallbackId;
        }
      } else {
        resolved =
          t.identityId.trim() !== "" && validIdSet.has(t.identityId)
            ? t.identityId
            : fallbackId;
      }
    }

    const needsPatch =
      resolved !== t.identityId || t.identityId.trim() === "";
    if (needsPatch) tradesPatched = true;
    return needsPatch ? { ...t, identityId: resolved, updatedAt: nowIsoFn() } : t;
  });

  if (tradesPatched) changed = true;

  if (activeIdentityId == null || !validIdSet.has(activeIdentityId)) {
    activeIdentityId = fallbackId;
    changed = true;
  }

  return {
    identities,
    challenges,
    trades,
    activeIdentityId,
    changed,
  };
}
