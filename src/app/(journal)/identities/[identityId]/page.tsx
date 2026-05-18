"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { ChallengesIndexPage } from "@/components/trade-log/challenges-index-page";
import { IdentityFormDialog } from "@/components/trade-log/identity-form-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTradingStore } from "@/models/trade-log/store";

export default function IdentityHubPage() {
  const raw = useParams().identityId;
  const identityId =
    typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";

  const identity = useTradingStore(
    useShallow((s) =>
      typeof identityId === "string" && identityId !== ""
        ? s.getIdentity(identityId)
        : undefined
    )
  );

  const [editOpen, setEditOpen] = useState(false);

  if (
    typeof identityId !== "string" ||
    identityId === "" ||
    identity == null
  ) {
    return (
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Workspace not found</CardTitle>
          <CardDescription>
            This workspace id is unknown or still loading.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="default" size="sm">
            <Link href="/identities">All workspaces</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <IdentityFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        identityId={identity.id}
      />

      <div className="flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Workspace
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">{identity.name}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {identity.note.trim()
              ? identity.note.trim()
              : "Optional: add payout or legal notes from Edit workspace."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/identities">All workspaces</Link>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setEditOpen(true)}
          >
            Edit workspace
          </Button>
        </div>
      </div>

      <ChallengesIndexPage scopedWorkspaceId={identityId} scopedMode />
    </div>
  );
}
