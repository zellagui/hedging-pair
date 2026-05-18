"use client";

import Link from "next/link";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { IdentityFormDialog } from "@/components/trade-log/identity-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTradingStore } from "@/models/trade-log/store";

export default function IdentitiesPage() {
  const { identities, challenges } = useTradingStore(
    useShallow((s) => ({ identities: s.identities, challenges: s.challenges }))
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sorted = [...identities].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  return (
    <div className="space-y-6">
      <IdentityFormDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditingId(null);
        }}
        identityId={editingId}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Workspaces</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One identity groups challenges and standalone trades — useful for separate
            legal names, payouts, or eval books.
          </p>
        </div>
        <Button
          type="button"
          className="self-start sm:self-auto"
          onClick={() => {
            setEditingId(null);
            setDialogOpen(true);
          }}
        >
          + New workspace
        </Button>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {sorted.map((ident) => {
          const cc = challenges.filter((c) => c.identityId === ident.id).length;

          return (
            <li key={ident.id}>
              <Card className="transition-colors hover:bg-muted/30">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="text-base">{ident.name}</CardTitle>
                      <CardDescription className="text-xs leading-relaxed">
                        {ident.note.trim() ? ident.note.trim() : "No details yet."}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {cc} challenge{cc === 1 ? "" : "s"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2 pt-0">
                  <Button asChild size="sm">
                    <Link href={`/identities/${ident.id}`}>Open</Link>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditingId(ident.id);
                      setDialogOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
