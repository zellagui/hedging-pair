import { JournalNav } from "@/components/trade-log/journal-nav";
import { TradingProviders } from "@/components/app/trading-providers";

export default function JournalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TradingProviders>
      <div className="flex min-h-full flex-1 flex-col bg-background">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <h1 className="text-lg font-semibold tracking-tight">
              Trading journal
            </h1>
            <JournalNav />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>
      </div>
    </TradingProviders>
  );
}
