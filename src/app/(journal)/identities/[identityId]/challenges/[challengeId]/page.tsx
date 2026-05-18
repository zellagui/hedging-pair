"use client";

import { useParams } from "next/navigation";

import { ChallengeDetailClient } from "@/components/trade-log/challenge-detail-client";

export default function IdentityChallengeDetailPage() {
  const rawI = useParams().identityId;
  const rawC = useParams().challengeId;
  const workspaceId =
    typeof rawI === "string" ? rawI : Array.isArray(rawI) ? rawI[0] : "";
  const challengeId =
    typeof rawC === "string" ? rawC : Array.isArray(rawC) ? rawC[0] : "";

  if (
    typeof workspaceId !== "string" ||
    workspaceId === "" ||
    typeof challengeId !== "string" ||
    challengeId === ""
  ) {
    return null;
  }

  return (
    <ChallengeDetailClient
      challengeId={challengeId}
      expectedWorkspaceId={workspaceId}
    />
  );
}
