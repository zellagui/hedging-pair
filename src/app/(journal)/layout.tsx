import { JournalUserMenu } from "@/components/auth/journal-user-menu";
import { JournalNav } from "@/components/trade-log/journal-nav";
import { TradingProviders } from "@/components/app/trading-providers";
import { loadJournalDataForCurrentUser } from "@/lib/supabase/load-journal-data";

export default async function JournalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { initialData, error: loadError } = await loadJournalDataForCurrentUser();

  return (
    <TradingProviders initialData={initialData} loadError={loadError}>
      <div className="flex min-h-full flex-1 flex-col bg-background">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <h1 className="text-lg font-semibold tracking-tight">
              Trading journal
            </h1>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <JournalNav />
              <JournalUserMenu />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>
      </div>
    </TradingProviders>
  );
}
