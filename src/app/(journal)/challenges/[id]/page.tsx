"use client";

import { useParams } from "next/navigation";

import { LegacyChallengeResolution } from "@/components/trade-log/challenge-legacy-redirect";

export default function ChallengeDetailPage() {
  const params = useParams();
  const raw = params.id;
  const challengeId =
    typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";

  if (typeof challengeId !== "string" || challengeId === "") {
    return null;
  }

  return <LegacyChallengeResolution challengeId={challengeId} />;
}
