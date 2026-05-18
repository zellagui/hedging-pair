"use client";

import { Badge } from "@/components/ui/badge";
import type { PairStatus } from "@/models/trade-log/types";

function statusEmoji(status: PairStatus): string {
  switch (status) {
    case "profitable":
      return "🟢";
    case "loss":
      return "🔴";
    case "break-even":
      return "🟡";
    case "open":
      return "⚪";
    case "invalid":
      return "⛔";
    default:
      return "⚪";
  }
}

export function PairStatusBadge({ status }: { status: PairStatus }) {
  const emoji = statusEmoji(status);
  const label = (() => {
    switch (status) {
      case "profitable":
        return "Profitable";
      case "loss":
        return "Loss";
      case "break-even":
        return "Break-even";
      case "open":
        return "Open";
      case "invalid":
        return "Invalid";
      default:
        return status;
    }
  })();

  const inner = (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden>{emoji}</span>
      <span>{label}</span>
    </span>
  );

  switch (status) {
    case "profitable":
      return (
        <Badge className="border-emerald-600/35 bg-emerald-600/12 font-normal text-emerald-900 dark:text-emerald-100">
          {inner}
        </Badge>
      );
    case "loss":
      return <Badge variant="destructive">{inner}</Badge>;
    case "break-even":
      return (
        <Badge variant="outline" className="font-normal">
          {inner}
        </Badge>
      );
    case "open":
      return (
        <Badge className="border-muted-foreground/40 bg-muted/40 font-normal text-foreground">
          {inner}
        </Badge>
      );
    case "invalid":
      return <Badge variant="destructive">{inner}</Badge>;
    default:
      return (
        <Badge variant="outline" className="font-normal">
          {inner}
        </Badge>
      );
  }
}
