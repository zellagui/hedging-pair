"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";

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
import { useTradingStore } from "@/models/trade-log/store";

interface WorkspaceDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
}

export function WorkspaceDeleteDialog({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
}: WorkspaceDeleteDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  
  const { deleteIdentity, challenges, trades, identities } = useTradingStore(
    useShallow((s) => ({
      deleteIdentity: s.deleteIdentity,
      challenges: s.challenges,
      trades: s.trades,
      identities: s.identities,
    }))
  );

  const challengesToDelete = challenges.filter(
    (c) => c.identityId === workspaceId
  ).length;
  const tradesToDelete = trades.filter(
    (t) => t.identityId === workspaceId
  ).length;

  const canDelete = identities.length > 1;
  const confirmRequired = workspaceName.toLowerCase();
  const confirmValid = confirmText.toLowerCase() === confirmRequired;

  const handleDelete = async () => {
    if (!confirmValid || !canDelete) return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      const success = await deleteIdentity(workspaceId);
      if (success) {
        onOpenChange(false);
        setConfirmText("");
      } else {
        setDeleteError("Could not delete this workspace. Please try again.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setConfirmText("");
    setDeleteError(null);
  };

  if (!canDelete) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cannot Delete Workspace</DialogTitle>
            <DialogDescription>
              You cannot delete the last remaining workspace. At least one workspace must exist.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setConfirmText("");
          setDeleteError(null);
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Workspace</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Are you sure you want to delete the workspace{" "}
                <strong>&quot;{workspaceName}&quot;</strong>?
              </p>
              {challengesToDelete > 0 || tradesToDelete > 0 ? (
                <div className="rounded-md bg-destructive/10 p-3 text-destructive">
                  <strong>Permanent deletion:</strong> This will remove{" "}
                  {challengesToDelete > 0 && (
                    <>
                      {challengesToDelete} challenge
                      {challengesToDelete !== 1 ? "s" : ""}
                    </>
                  )}
                  {challengesToDelete > 0 && tradesToDelete > 0 && ", "}
                  {tradesToDelete > 0 && (
                    <>
                      {tradesToDelete} trade{tradesToDelete !== 1 ? "s" : ""}
                    </>
                  )}
                  , and all linked hedge pairs. Other workspaces are not affected.
                </div>
              ) : (
                <p>
                  This workspace has no challenges or trades. Other workspaces are
                  not affected.
                </p>
              )}
              {deleteError != null ? (
                <p className="text-destructive">{deleteError}</p>
              ) : null}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="confirm-input">
              Type <code className="text-sm font-mono bg-muted px-1 py-0.5 rounded">{workspaceName.toLowerCase()}</code> to confirm deletion:
            </Label>
            <Input
              id="confirm-input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={`Type "${workspaceName.toLowerCase()}" to confirm`}
              className="mt-2"
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!confirmValid || isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Workspace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}