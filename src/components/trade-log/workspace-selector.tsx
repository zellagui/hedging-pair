"use client";

import { useState } from "react";
import { MoreHorizontal, Plus, Edit, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useTradingStore } from "@/models/trade-log/store";
import { IdentityFormDialog } from "./identity-form-dialog";
import { WorkspaceDeleteDialog } from "./workspace-delete-dialog";

interface WorkspaceSelectorProps {
  selectedWorkspaceId: string | null;
  onWorkspaceChange: (workspaceId: string | null) => void;
  showAllOption?: boolean;
  className?: string;
}

export function WorkspaceSelector({
  selectedWorkspaceId,
  onWorkspaceChange,
  showAllOption = true,
  className,
}: WorkspaceSelectorProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const identities = useTradingStore((s) => s.identities);
  
  const sortedIdentities = [...identities].sort((a, b) => a.name.localeCompare(b.name));
  
  const selectedWorkspace = selectedWorkspaceId 
    ? identities.find(i => i.id === selectedWorkspaceId)
    : null;

  const handleNewWorkspace = () => {
    setEditingId(null);
    setFormOpen(true);
  };

  const handleEditWorkspace = (id: string) => {
    setEditingId(id);
    setFormOpen(true);
  };

  const handleDeleteWorkspace = (id: string) => {
    setDeletingId(id);
    setDeleteOpen(true);
  };

  return (
    <>
      <div className={`flex items-center gap-2 ${className}`}>
        <Select
          value={selectedWorkspaceId || "all"}
          onValueChange={(value) => onWorkspaceChange(value === "all" ? null : value)}
        >
          <SelectTrigger className="min-w-[180px]">
            <SelectValue>
              {selectedWorkspaceId ? selectedWorkspace?.name || "Unknown" : "All Workspaces"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {showAllOption && (
              <SelectItem value="all">All Workspaces</SelectItem>
            )}
            {sortedIdentities.map((identity) => (
              <SelectItem key={identity.id} value={identity.id}>
                {identity.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleNewWorkspace}>
              <Plus className="mr-2 h-4 w-4" />
              New Workspace
            </DropdownMenuItem>
            {selectedWorkspaceId && selectedWorkspace && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleEditWorkspace(selectedWorkspaceId)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit {selectedWorkspace.name}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDeleteWorkspace(selectedWorkspaceId)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete {selectedWorkspace.name}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <IdentityFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        identityId={editingId}
      />

      {deletingId && (
        <WorkspaceDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          workspaceId={deletingId}
          workspaceName={identities.find(i => i.id === deletingId)?.name || ""}
        />
      )}
    </>
  );
}