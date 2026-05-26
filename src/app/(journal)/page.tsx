"use client";

import { useShallow } from "zustand/react/shallow";

import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { useTradingStore } from "@/models/trade-log/store";

export default function HomePage() {
  const {
    trades,
    challenges,
    pairs,
    identities,
    sessions,
  } = useTradingStore(
    useShallow((s) => ({
      trades: s.trades,
      challenges: s.challenges,
      pairs: s.pairs,
      identities: s.identities,
      sessions: s.sessions,
    }))
  );

  return (
    <DashboardOverview
      trades={trades}
      challenges={challenges}
      pairs={pairs}
      sessions={sessions}
      identities={identities}
    />
  );
}
