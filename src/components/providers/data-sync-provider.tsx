"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTradingStore } from "@/models/trade-log/store";
import { createClient } from "@/lib/supabase/client";
import type { LoadedJournalData } from "@/lib/trading/process-loaded-journal-data";

type DataSyncProviderProps = {
  children: React.ReactNode;
  initialData?: LoadedJournalData | null;
  loadError?: string | null;
};

/**
 * Seeds journal data from the server on first paint, then keeps auth in sync.
 * Server-side load avoids client cookie/RLS issues and removes the slow bootstrap spinner.
 */
export function DataSyncProvider({
  children,
  initialData = null,
  loadError = null,
}: DataSyncProviderProps) {
  const hasServerBootstrap = initialData != null || loadError != null;
  const seededRef = useRef(false);
  const bootstrapDone = useRef(hasServerBootstrap);
  const [authReady, setAuthReady] = useState(hasServerBootstrap);
  const [hasSession, setHasSession] = useState(Boolean(initialData));

  const hydrate = useTradingStore((s) => s.hydrate);
  const seedFromServer = useTradingStore((s) => s.seedFromServer);
  const isHydrated = useTradingStore((s) => s.isHydrated);
  const isLoading = useTradingStore((s) => s.isLoading);
  const error = useTradingStore((s) => s.error);

  useLayoutEffect(() => {
    if (seededRef.current) return;

    if (initialData) {
      seedFromServer(initialData);
      seededRef.current = true;
      return;
    }

    if (loadError) {
      useTradingStore.setState({
        error: loadError,
        isHydrated: true,
        isLoading: false,
      });
      seededRef.current = true;
    }
  }, [initialData, loadError, seedFromServer]);

  useEffect(() => {
    if (hasServerBootstrap) {
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (cancelled) return;

        setHasSession(!!user);
        setAuthReady(true);

        if (user) {
          await hydrate();
        } else {
          useTradingStore.setState({
            isHydrated: true,
            isLoading: false,
            error: null,
          });
        }
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to check auth session";
        setAuthReady(true);
        setHasSession(false);
        useTradingStore.setState({
          error: message,
          isLoading: false,
          isHydrated: true,
        });
      } finally {
        if (!cancelled) {
          bootstrapDone.current = true;
        }
      }
    };

    void init();

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setHasSession(!!session);

      if (event === "SIGNED_OUT") {
        useTradingStore.setState({
          sessions: [],
          trades: [],
          pairs: [],
          challenges: [],
          identities: [],
          plans: [],
          activeIdentityId: null,
          isHydrated: true,
          isLoading: false,
          error: null,
        });
        return;
      }

      if (event === "SIGNED_IN" && session && !useTradingStore.getState().isHydrated) {
        await hydrate();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [hasServerBootstrap, hydrate]);

  const showLoader =
    !authReady || (!bootstrapDone.current && hasSession && isLoading && !isHydrated);

  if (showLoader) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Loading your journal...</p>
        </div>
      </div>
    );
  }

  if (error && hasSession) {
    const isSchemaMissing =
      error.includes("Could not find the table") ||
      error.includes("relation") ||
      error.includes("schema cache");

    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-lg border border-destructive bg-destructive/10 p-6 text-center">
          <h2 className="mb-2 text-lg font-semibold text-destructive">
            Failed to Load Data
          </h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          {isSchemaMissing ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Apply the SQL migration in Supabase Dashboard first (see MIGRATION_INSTRUCTIONS.md).
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                useTradingStore.setState({
                  isHydrated: false,
                  isLoading: false,
                  error: null,
                });
                void hydrate();
              }}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
