"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { ChallengeFormDialog } from "@/components/trade-log/challenge-form-dialog";
import { WorkspaceOverviewPanels } from "@/components/trade-log/overview-stats";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildWorkspaceOverviewDigest } from "@/models/trade-log/overview-digest";
import { filterTradeLogSliceByIdentity } from "@/models/trade-log/identity-scope";
import { useTradingStore } from "@/models/trade-log/store";

const NAV_LINKS: { href: string; label: string; hint: string }[] = [
  {
    href: "/identities",
    label: "Workspaces",
    hint: "Legal / book identities grouping challenges",
  },
  {
    href: "/challenges",
    label: "Challenges",
    hint: "Eval rows, health, hedge pairs",
  },
  { href: "/trades", label: "Trades", hint: "Journal entries & filters" },
  { href: "/pairs", label: "Pairs", hint: "Link and review hedges" },
  { href: "/sessions", label: "Sessions", hint: "Daily workflow rhythm" },
  { href: "/accounts", label: "Accounts", hint: "Workspace accounts" },
  {
    href: "/data",
    label: "Data",
    hint: "CSV folder sync, scoped export, JSON backup",
  },
];

export default function HomePage() {
  const router = useRouter();
  const {
    trades,
    challenges,
    pairs,
    identities,
    sessions,
    activeIdentityId,
    setActiveIdentityId,
  } = useTradingStore(
    useShallow((s) => ({
      trades: s.trades,
      challenges: s.challenges,
      pairs: s.pairs,
      identities: s.identities,
      sessions: s.sessions,
      activeIdentityId: s.activeIdentityId,
      setActiveIdentityId: s.setActiveIdentityId,
    }))
  );

  const sortedIdentities = useMemo(
    () =>
      [...identities].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      ),
    [identities]
  );

  const effectiveWorkspaceId =
    activeIdentityId != null &&
    identities.some((i) => i.id === activeIdentityId)
      ? activeIdentityId
      : identities[0]?.id ?? "";

  const activeLabel =
    sortedIdentities.find((i) => i.id === effectiveWorkspaceId)?.name ??
    "Workspace";

  const { trades: fTrades, challenges: fChallenges, pairs: fPairs } =
    useMemo(() => {
      if (
        typeof effectiveWorkspaceId !== "string" ||
        effectiveWorkspaceId.trim() === ""
      ) {
        return {
          trades: [],
          challenges: [],
          pairs: [],
        };
      }
      return filterTradeLogSliceByIdentity(
        trades,
        challenges,
        pairs,
        effectiveWorkspaceId
      );
    }, [
      trades,
      challenges,
      pairs,
      effectiveWorkspaceId,
    ]);

  const workspaceIdentity = useMemo(
    () =>
      sortedIdentities.find((i) => i.id === effectiveWorkspaceId) ?? null,
    [sortedIdentities, effectiveWorkspaceId]
  );

  const overviewDigest = useMemo(() => {
    if (
      workspaceIdentity == null ||
      effectiveWorkspaceId.trim() === ""
    ) {
      return null;
    }
    return buildWorkspaceOverviewDigest({
      identity: workspaceIdentity,
      sessions,
      trades: fTrades,
      challenges: fChallenges,
      pairs: fPairs,
    });
  }, [
    workspaceIdentity,
    sessions,
    fTrades,
    fChallenges,
    fPairs,
    effectiveWorkspaceId,
  ]);

  const [challengeDialogOpen, setChallengeDialogOpen] = useState(false);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Overview</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Firm challenges, hedge pairs, and personal legs—all scoped here so you
          can see runway health without hunting through menus.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/25 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Label htmlFor="overview-scope" className="text-sm font-medium">
          Overview scope
        </Label>
        <Select
          value={effectiveWorkspaceId !== "" ? effectiveWorkspaceId : undefined}
          onValueChange={(v) => setActiveIdentityId(v)}
        >
          <SelectTrigger id="overview-scope" className="sm:w-[min(100%,18rem)]">
            <SelectValue placeholder="Pick workspace" />
          </SelectTrigger>
          <SelectContent>
            {sortedIdentities.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="-mt-4 text-xs text-muted-foreground">
        Showing&nbsp;
        <span className="font-medium text-foreground">{activeLabel}</span>{" "}
        only. Fees are one-off challenge entries—not every execution fee unless you
        log them separately.
      </p>

      {overviewDigest != null ? (
        <WorkspaceOverviewPanels digest={overviewDigest} />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Pick a workspace to load the cockpit.
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/15 bg-primary/3">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Where to work next</CardTitle>
          <CardDescription>
            Open the global challenge roster or drill into one workspace hub.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button asChild>
            <Link href={`/identities/${effectiveWorkspaceId}`}>
              Open this workspace
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/challenges">All challenges</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setChallengeDialogOpen(true)}
          >
            New challenge
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {NAV_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="group rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40"
          >
            <p className="font-semibold text-foreground group-hover:underline">
              {l.label}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{l.hint}</p>
          </Link>
        ))}
      </div>

      <ChallengeFormDialog
        open={challengeDialogOpen}
        onOpenChange={(o) => {
          setChallengeDialogOpen(o);
        }}
        challengeId={null}
        defaultWorkspaceId={
          effectiveWorkspaceId !== "" ? effectiveWorkspaceId : null
        }
        onCreated={(id) => {
          const cc = useTradingStore.getState().getChallenge(id);
          if (cc) {
            router.push(`/identities/${cc.identityId}/challenges/${cc.id}`);
            return;
          }
          router.push(`/challenges/${id}`);
        }}
      />
    </div>
  );
}
