import { Badge } from "@/components/ui/badge";
import { commandHeaderMock } from "@/lib/dashboard-mock";

export function CommandHeader({ todayLabel }: { todayLabel: string }) {
  const { systemName, sessionActive, sessionDetail, sessionInactiveLabel } =
    commandHeaderMock;

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">
            Welcome to {systemName} — {todayLabel}
          </p>
          <p className="text-xs text-muted-foreground">
            Today&apos;s result · Active risk · Combined system P&amp;L · Status
            at a glance
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Status
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={sessionActive ? "default" : "secondary"}>
              {sessionActive ? "Active Session / Trading Day" : "No active session"}
            </Badge>
            {sessionActive ? (
              <span className="text-sm text-muted-foreground">{sessionDetail}</span>
            ) : (
              <span className="text-sm text-muted-foreground">
                {sessionInactiveLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
