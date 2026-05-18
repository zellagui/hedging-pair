import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { AccountKind, AccountStatus, AccountTile } from "@/lib/dashboard-mock";
import { formatUsdUnsigned } from "@/lib/format-dashboard";
import { cn } from "@/lib/utils";

function kindLabel(kind: AccountKind) {
  if (kind === "challenge") return "Challenge accounts";
  if (kind === "funded") return "Funded accounts";
  return "Personal accounts";
}

function statusBadge(status: AccountStatus) {
  if (status === "active") {
    return <Badge variant="default">Active</Badge>;
  }
  if (status === "passed") {
    return <Badge variant="secondary">Passed</Badge>;
  }
  return <Badge variant="destructive">Failed</Badge>;
}

function AccountTileCard({ account }: { account: AccountTile }) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold leading-tight">
            {account.label}
          </CardTitle>
          {statusBadge(account.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Balance</p>
          <p className="font-medium tabular-nums text-foreground">
            {formatUsdUnsigned(account.balance)}
          </p>
        </div>
        {account.payout != null ? (
          <div>
            <p className="text-xs text-muted-foreground">Payout</p>
            <p className="font-medium tabular-nums text-foreground">
              {formatUsdUnsigned(account.payout)}
            </p>
          </div>
        ) : null}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Target progress</span>
            <span className="tabular-nums text-foreground">
              {account.targetProgressPct}%
            </span>
          </div>
          <Progress value={account.targetProgressPct} />
        </div>
      </CardContent>
    </Card>
  );
}

function AccountGroup({
  title,
  tiles,
}: {
  title: string;
  tiles: AccountTile[];
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <div
        className={cn(
          "grid gap-3",
          tiles.length > 1 ? "sm:grid-cols-2" : "sm:grid-cols-1"
        )}
      >
        {tiles.map((t) => (
          <AccountTileCard key={t.id} account={t} />
        ))}
      </div>
    </div>
  );
}

export function AccountsGlance({
  groups,
}: {
  groups: {
    challenge: AccountTile[];
    funded: AccountTile[];
    personal: AccountTile[];
  };
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="font-semibold tracking-tight">
          Accounts at a glance
        </CardTitle>
        <CardDescription>
          Challenge · funded · personal — status, balance, target progress
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <AccountGroup
          title={kindLabel("challenge")}
          tiles={groups.challenge}
        />
        <AccountGroup title={kindLabel("funded")} tiles={groups.funded} />
        <AccountGroup title={kindLabel("personal")} tiles={groups.personal} />
      </CardContent>
    </Card>
  );
}
