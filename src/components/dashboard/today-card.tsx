import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDisplayDate, formatUsd } from "@/lib/format-dashboard";
import { cn } from "@/lib/utils";

type TodaySnapshot = {
  sessionDate: string;
  plan: string;
  trades: { count: number; items: string[] };
  sessionPnl: number;
  notes: string;
};

function pnlClass(pnl: number) {
  return cn(
    pnl > 0 && "text-emerald-600 dark:text-emerald-400",
    pnl < 0 && "text-red-600 dark:text-red-400"
  );
}

function cardToneClass(pnl: number) {
  return cn(
    "shadow-sm",
    pnl > 0 && "border-emerald-500/35",
    pnl < 0 && "border-red-500/35",
    pnl === 0 && "border-border"
  );
}

export function TodaySnapshotCard({ data }: { data: TodaySnapshot }) {
  const titleDate = formatDisplayDate(data.sessionDate);

  return (
    <Card className={cardToneClass(data.sessionPnl)}>
      <CardHeader>
        <CardTitle className="font-semibold tracking-tight">
          TODAY — {titleDate}
        </CardTitle>
        <CardDescription>
          Session snapshot · trades · result · notes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pre-session plan
          </p>
          <p className="mt-1 text-sm leading-relaxed text-foreground">
            {data.plan}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Trades taken today
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {data.trades.count} total
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
            {data.trades.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Session result
          </p>
          <p
            className={cn(
              "mt-1 text-2xl font-semibold tabular-nums",
              pnlClass(data.sessionPnl)
            )}
          >
            {formatUsd(data.sessionPnl)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Notes
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {data.notes}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Screenshot
          </p>
          <div className="mt-2 flex aspect-video w-full max-w-md items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 text-sm text-muted-foreground">
            Screenshot placeholder
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
