"use client";

import { useEffect, useState } from "react";

import {
  bootstrapTradeLogCloudSync,
  subscribeDebouncedCloudSync,
} from "@/models/trade-log/blob-sync";
import {
  bootstrapTradeLogWorkspaceCsv,
  subscribeDebouncedTradeLogWorkspaceCsv,
} from "@/models/trade-log/workspace-csv-sync";
import { useTradingStore } from "@/lib/trading/store";

export function TradingProviders({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const runAfterHydrate = () => {
      setReady(true);
    };

    const unsub = useTradingStore.persist.onFinishHydration(runAfterHydrate);

    if (useTradingStore.persist.hasHydrated()) {
      queueMicrotask(runAfterHydrate);
    } else {
      void useTradingStore.persist.rehydrate();
    }

    return unsub;
  }, []);

  useEffect(() => {
    if (!ready) return;

    let unsubCsv: (() => void) | undefined;
    let unsubCloud: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      await bootstrapTradeLogWorkspaceCsv();
      if (cancelled) return;
      await bootstrapTradeLogCloudSync();
      if (cancelled) return;
      unsubCsv = subscribeDebouncedTradeLogWorkspaceCsv(560);
      unsubCloud = subscribeDebouncedCloudSync(600);
    })();

    return () => {
      cancelled = true;
      unsubCsv?.();
      unsubCloud?.();
    };
  }, [ready]);

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
        <p>Loading workspace…</p>
      </div>
    );
  }

  return <>{children}</>;
}
