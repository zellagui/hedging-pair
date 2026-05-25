import { formatMoney } from "@/models/trade-log/format";
import type { Challenge } from "@/models/trade-log/types";
import { cn } from "@/lib/utils";

type Props = {
  challenge: Challenge;
  className?: string;
};

function RefItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-muted-foreground/70">{label}</span>
      <span className="font-medium tabular-nums text-foreground/80">{value}</span>
    </span>
  );
}

/** Compact firm/eval rules shown above the KPI strip. */
export function ChallengeEvalReference({ challenge, className }: Props) {
  const note = challenge.note.trim();

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border/30 bg-muted/15 px-3 py-2 text-xs",
        className
      )}
    >
      <span className="shrink-0 font-medium text-muted-foreground">Firm / eval</span>
      <span className="hidden h-3 w-px shrink-0 bg-border/60 sm:inline-block" aria-hidden />
      <RefItem label="Balance" value={formatMoney(challenge.balance)} />
      <RefItem label="Target" value={formatMoney(challenge.currentProfitTarget)} />
      <RefItem label="Max DD" value={formatMoney(challenge.maxDrawdown)} />
      <RefItem label="Daily cap" value={formatMoney(challenge.dailyLossCap)} />
      {note ? (
        <>
          <span className="hidden h-3 w-px shrink-0 bg-border/60 lg:inline-block" aria-hidden />
          <span className="min-w-0 truncate text-muted-foreground/80" title={note}>
            {note}
          </span>
        </>
      ) : null}
    </div>
  );
}
