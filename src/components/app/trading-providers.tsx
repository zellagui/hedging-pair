"use client";

import { DataSyncProvider } from "@/components/providers/data-sync-provider";
import type { LoadedJournalData } from "@/lib/trading/process-loaded-journal-data";

type TradingProvidersProps = {
  children: React.ReactNode;
  initialData?: LoadedJournalData | null;
  loadError?: string | null;
};

export function TradingProviders({
  children,
  initialData = null,
  loadError = null,
}: TradingProvidersProps) {
  return (
    <DataSyncProvider initialData={initialData} loadError={loadError}>
      {children}
    </DataSyncProvider>
  );
}
