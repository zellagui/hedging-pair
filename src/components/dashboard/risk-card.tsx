import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { RiskTone } from "@/lib/dashboard-mock";
import { formatPercent, formatUsdUnsigned } from "@/lib/format-dashboard";
import { cn } from "@/lib/utils";

export type RiskCardModel = {
  tone: RiskTone;
  dailyDrawdownUsedPct: number;
  maxDrawdownUsedPct: number;
  openRisk: number;
  ruleAlerts: string[];
};

function toneBadge(tone: RiskTone) {
  if (tone === "safe") {
    return <Badge variant="secondary">Safe zone</Badge>;
  }
  if (tone === "warning") {
    return (
      <Badge variant="outline" className="border-amber-500/50 text-amber-800 dark:text-amber-400">
        Warning
      </Badge>
    );
  }
  return <Badge variant="destructive">Danger</Badge>;
}

function toneBorder(tone: RiskTone) {
  return cn(
    "shadow-sm border-l-4",
    tone === "safe" && "border-l-emerald-500",
    tone === "warning" && "border-l-amber-500",
    tone === "danger" && "border-l-destructive"
  );
}

export function RiskStatusCard({ data }: { data: RiskCardModel }) {
  return (
    <Card className={toneBorder(data.tone)}>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="font-semibold tracking-tight">
            Risk &amp; rules
          </CardTitle>
          <CardDescription>
            Daily / max drawdown used · open risk · rule alerts
          </CardDescription>
        </div>
        {toneBadge(data.tone)}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Daily drawdown used</span>
            <span className="font-medium tabular-nums text-foreground">
              {formatPercent(data.dailyDrawdownUsedPct)}
              {data.dailyDrawdownUsedPct >= 80 ? (
                <span className="ml-2 text-destructive">(High)</span>
              ) : null}
            </span>
          </div>
          <Progress value={data.dailyDrawdownUsedPct} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Max drawdown used</span>
            <span className="font-medium tabular-nums text-foreground">
              {formatPercent(data.maxDrawdownUsedPct)}
            </span>
          </div>
          <Progress value={data.maxDrawdownUsedPct} />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Open risk
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {formatUsdUnsigned(data.openRisk)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Rule alerts
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
            {data.ruleAlerts.map((alert) => (
              <li key={alert}>{alert}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
