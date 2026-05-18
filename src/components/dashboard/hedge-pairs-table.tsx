import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { HedgeOutcome, HedgePairRow } from "@/lib/dashboard-mock";
import { formatUsd } from "@/lib/format-dashboard";

function outcomeBadge(outcome: HedgeOutcome) {
  if (outcome === "profitable") {
    return <Badge variant="secondary">Profitable</Badge>;
  }
  if (outcome === "break_even") {
    return <Badge variant="outline">Break-even</Badge>;
  }
  return <Badge variant="destructive">Loss</Badge>;
}

export function HedgePairsTable({ rows }: { rows: HedgePairRow[] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="font-semibold tracking-tight">
          Recent hedge pairs
        </CardTitle>
        <CardDescription>
          Last sessions — challenge vs personal — combined P&amp;L
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-normal">Challenge trade</TableHead>
              <TableHead className="whitespace-normal">Personal trade</TableHead>
              <TableHead>Combined P&amp;L</TableHead>
              <TableHead>Outcome</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="max-w-[200px] whitespace-normal">
                  {row.challengeTrade}
                </TableCell>
                <TableCell className="max-w-[200px] whitespace-normal">
                  {row.personalTrade}
                </TableCell>
                <TableCell
                  className={
                    row.combinedPnl > 0
                      ? "font-medium text-emerald-600 tabular-nums dark:text-emerald-400"
                      : row.combinedPnl < 0
                        ? "font-medium text-red-600 tabular-nums dark:text-red-400"
                        : "font-medium tabular-nums"
                  }
                >
                  {formatUsd(row.combinedPnl)}
                </TableCell>
                <TableCell>{outcomeBadge(row.outcome)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
