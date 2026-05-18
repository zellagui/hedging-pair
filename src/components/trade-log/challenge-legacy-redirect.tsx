"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ChallengeDetailClient } from "@/components/trade-log/challenge-detail-client";
import { useTradingStore } from "@/models/trade-log/store";

/**
 * Loads `/challenges/[id]` and canonicalizes to `/identities/.../challenges/[id]` when known.
 */
export function LegacyChallengeResolution({
  challengeId,
}: {
  challengeId: string;
}) {
  const router = useRouter();
  const challenge = useTradingStore((s) => s.getChallenge(challengeId));

  useEffect(() => {
    if (!challenge) return;
    router.replace(
      `/identities/${challenge.identityId}/challenges/${challenge.id}`
    );
  }, [challenge, challengeId, router]);

  if (challenge) {
    return (
      <p className="text-sm text-muted-foreground">
        Redirecting to your workspace route…
      </p>
    );
  }

  return <ChallengeDetailClient challengeId={challengeId} />;
}
