"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTradingStore } from "@/models/trade-log/store";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  identityId: string | null;
};

export function IdentityFormDialog({
  open,
  onOpenChange,
  identityId,
}: Props) {
  const identitiesLen = useTradingStore((s) => s.identities.length);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <IdentityFormInner
          key={`${identityId ?? "new"}-${identitiesLen}`}
          identityId={identityId}
          onOpenChange={onOpenChange}
        />
      ) : null}
    </Dialog>
  );
}

function IdentityFormInner({
  identityId,
  onOpenChange,
}: {
  identityId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const identities = useTradingStore((s) => s.identities);
  const addIdentity = useTradingStore((s) => s.addIdentity);
  const updateIdentity = useTradingStore((s) => s.updateIdentity);

  const existing = useMemo(
    () =>
      identityId ? identities.find((x) => x.id === identityId) : undefined,
    [identityId, identities]
  );

  const [name, setName] = useState(() => existing?.name ?? "");
  const [note, setNote] = useState(() => existing?.note ?? "");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    const o = note.trim();
    if (existing) {
      updateIdentity(existing.id, { name: n, note: o });
    } else {
      addIdentity({ name: n || "Untitled workspace", note: o });
    }
    onOpenChange(false);
  }

  return (
    <DialogContent className="sm:max-w-md">
      <form onSubmit={onSubmit}>
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit workspace" : "New workspace"}
          </DialogTitle>
          <DialogDescription>
            Identities separate prop-firm books (legal names, spouses, entities).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="id-name">Name</Label>
            <Input
              id="id-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Primary eval book"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="id-note">Details (optional)</Label>
            <Textarea
              id="id-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Legal name, jurisdiction, payout notes…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">{existing ? "Save" : "Create"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
