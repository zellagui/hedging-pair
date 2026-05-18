import { AccountsGlance } from "@/components/dashboard/accounts-glance";
import { CommandHeader } from "@/components/dashboard/command-header";
import { HedgePairsTable } from "@/components/dashboard/hedge-pairs-table";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { RiskStatusCard } from "@/components/dashboard/risk-card";
import { TodaySnapshotCard } from "@/components/dashboard/today-card";
import {
  accountsMock,
  hedgePairsMock,
  kpiMock,
  riskMock,
  todaySnapshotMock,
} from "@/lib/dashboard-mock";

export function CommandCenter() {
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:py-10">
      <CommandHeader todayLabel={todayLabel} />
      <KpiStrip metrics={kpiMock} />
      <div className="grid gap-6 lg:grid-cols-2">
        <TodaySnapshotCard data={todaySnapshotMock} />
        <RiskStatusCard data={riskMock} />
      </div>
      <AccountsGlance groups={accountsMock} />
      <HedgePairsTable rows={hedgePairsMock} />
    </div>
  );
}
