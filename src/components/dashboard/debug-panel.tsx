"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney } from "@/models/trade-log/format";
import type {
  Challenge,
  HedgePair,
  LogTrade,
} from "@/models/trade-log/types";
import { getDebugChallengeBreakdown } from "@/models/trade-log/workspace-metrics";

interface DebugPanelProps {
  trades: LogTrade[];
  challenges: Challenge[];
  pairs: HedgePair[];
}

export function DebugPanel({ trades, challenges, pairs }: DebugPanelProps) {
  const [isVisible, setIsVisible] = useState(false);

  // Only show in development
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const debugData = getDebugChallengeBreakdown(trades, challenges, pairs);

  return (
    <div className="mt-8">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsVisible(!isVisible)}
        className="mb-4"
      >
        {isVisible ? "Hide" : "Show"} Debug Panel
      </Button>

      {isVisible && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20">
          <CardHeader>
            <CardTitle className="text-sm text-yellow-800 dark:text-yellow-200">
              Debug: Challenge-by-Challenge Breakdown
            </CardTitle>
            <CardDescription className="text-yellow-700 dark:text-yellow-300">
              Compares old calculation method (raw directPnl) vs canonical method (includes hedge pairs)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-yellow-200 dark:border-yellow-800">
                    <th className="text-left p-2 font-medium">Challenge</th>
                    <th className="text-left p-2 font-medium">Status</th>
                    <th className="text-right p-2 font-medium">Fee</th>
                    <th className="text-right p-2 font-medium">Raw Prop Sum</th>
                    <th className="text-right p-2 font-medium">Raw Personal Sum</th>
                    <th className="text-center p-2 font-medium">Pairs</th>
                    <th className="text-right p-2 font-medium">Canonical Combined</th>
                    <th className="text-right p-2 font-medium">Net After Fee</th>
                    <th className="text-right p-2 font-medium">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {debugData.map((item) => {
                    const rawCombined = item.rawPropSum + item.rawPersonalSum;
                    const canonicalCombined = item.canonicalMetrics.combinedRealized;
                    const difference = canonicalCombined - rawCombined;
                    const hasDifference = Math.abs(difference) > 0.01;

                    return (
                      <tr
                        key={item.id}
                        className={`border-b border-yellow-100 dark:border-yellow-900 ${
                          hasDifference ? "bg-yellow-100 dark:bg-yellow-900/30" : ""
                        }`}
                      >
                        <td className="p-2 font-mono text-xs">
                          <div>{item.name}</div>
                          <div className="text-gray-500">{item.id.slice(0, 8)}...</div>
                        </td>
                        <td className="p-2">
                          <span className={`px-1 py-0.5 rounded text-xs ${getStatusColor(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="p-2 text-right font-mono">{formatMoney(item.fee)}</td>
                        <td className="p-2 text-right font-mono">{formatMoney(item.rawPropSum)}</td>
                        <td className="p-2 text-right font-mono">{formatMoney(item.rawPersonalSum)}</td>
                        <td className="p-2 text-center">{item.pairedCount}</td>
                        <td className="p-2 text-right font-mono font-medium">
                          {formatMoney(canonicalCombined)}
                        </td>
                        <td className="p-2 text-right font-mono">{formatMoney(item.netAfterFee)}</td>
                        <td className={`p-2 text-right font-mono ${hasDifference ? "font-bold text-orange-600" : ""}`}>
                          {hasDifference ? formatMoney(difference) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-4 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
              <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                Key Insights:
              </h4>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                <li>• <strong>Raw sums</strong>: Old method using only trade.directPnl</li>
                <li>• <strong>Canonical combined</strong>: New method using hedge pairs + individual trades</li>
                <li>• <strong>Pairs column</strong>: Number of hedge pairs for this challenge</li>
                <li>• <strong>Highlighted rows</strong>: Where old vs new methods differ significantly</li>
                <li>• <strong>Differences</strong>: Often caused by trades with directPnl=0 but combinedPnl≠0</li>
              </ul>
            </div>

            <div className="mt-4 text-xs text-yellow-600 dark:text-yellow-400">
              This panel only appears in development mode.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case "evaluation":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200";
    case "passed":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200";
    case "failed":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200";
    case "funded":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200";
    case "paid_out":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200";
  }
}

// Compact version for smaller spaces
interface CompactDebugInfoProps {
  trades: LogTrade[];
  challenges: Challenge[];
  pairs: HedgePair[];
  className?: string;
}

export function CompactDebugInfo({
  trades,
  challenges,
  pairs,
  className,
}: CompactDebugInfoProps) {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const debugData = getDebugChallengeBreakdown(trades, challenges, pairs);
  const totalDifferences = debugData.reduce((count, item) => {
    const rawCombined = item.rawPropSum + item.rawPersonalSum;
    const canonicalCombined = item.canonicalMetrics.combinedRealized;
    const difference = Math.abs(canonicalCombined - rawCombined);
    return difference > 0.01 ? count + 1 : count;
  }, 0);

  const totalPairs = debugData.reduce((sum, item) => sum + item.pairedCount, 0);

  return (
    <div className={`text-xs text-muted-foreground ${className}`}>
      <span className="font-medium">Debug:</span> {debugData.length} challenges, {totalPairs} pairs, {totalDifferences} with calc differences
    </div>
  );
}