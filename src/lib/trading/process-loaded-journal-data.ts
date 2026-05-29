import { applyChallengeDrawdownBreachFailure } from "@/models/trade-log/challenges";
import { ensureIdentityConsistency } from "@/models/trade-log/identity-scope";
import type {
  Challenge,
  HedgePair,
  Identity,
  LogSession,
  LogTrade,
  PhasePlan,
} from "@/models/trade-log/types";

export type LoadedJournalData = {
  identities: Identity[];
  challenges: Challenge[];
  trades: LogTrade[];
  pairs: HedgePair[];
  sessions: LogSession[];
  plans: PhasePlan[];
  activeIdentityId: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

export function processLoadedJournalData(
  data: LoadedJournalData
): LoadedJournalData {
  const challengesAfterBreaches = applyChallengeDrawdownBreachFailure(
    data.challenges,
    data.trades,
    data.pairs,
    nowIso
  );

  const synced = ensureIdentityConsistency({
    identities: data.identities,
    challenges: challengesAfterBreaches,
    trades: data.trades,
    pairs: data.pairs,
    activeIdentityId: data.activeIdentityId,
    nowIso,
  });

  return {
    identities: synced.identities,
    challenges: synced.challenges,
    trades: synced.trades,
    pairs: data.pairs,
    sessions: data.sessions,
    plans: data.plans,
    activeIdentityId: synced.activeIdentityId,
  };
}
