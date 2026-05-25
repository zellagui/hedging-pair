"use client";

import { useShallow } from "zustand/react/shallow";

import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { useTradingStore } from "@/models/trade-log/store";

export default function HomePage() {
  const {
    trades,
    challenges,
    identities,
    sessions,
    activeIdentityId,
    setActiveIdentityId,
  } = useTradingStore(
    useShallow((s) => ({
      trades: s.trades,
      challenges: s.challenges,
      identities: s.identities,
      sessions: s.sessions,
      activeIdentityId: s.activeIdentityId,
      setActiveIdentityId: s.setActiveIdentityId,
    }))
  );

  return (
    <DashboardOverview
      trades={trades}
      challenges={challenges}
      sessions={sessions}
      identities={identities}
      activeIdentityId={activeIdentityId}
      onWorkspaceChange={setActiveIdentityId}
    />
  );
}
