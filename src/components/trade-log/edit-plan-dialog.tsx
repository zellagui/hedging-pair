"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PhasePlan } from "@/models/trade-log/types";

interface EditPlanDialogProps {
  open: boolean;
  plan: PhasePlan | null;
  onOpenChange: (open: boolean) => void;
  onSave: (planId: string, updates: Partial<PhasePlan>) => void;
}

function qNum(s: string, fallback = 0) {
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

export function EditPlanDialog({ 
  open, 
  plan, 
  onOpenChange, 
  onSave 
}: EditPlanDialogProps) {
  const [formData, setFormData] = useState({
    propTpUsd: "",
    propSlUsd: "",
    propContracts: "",
    personalTargetProfit: "",
    buffer: "",
    expectedPayout: "",
  });
  
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset form when plan changes
  useEffect(() => {
    if (plan) {
      setFormData({
        propTpUsd: String(plan.propTpUsd),
        propSlUsd: String(plan.propSlUsd),
        propContracts: String(plan.propContracts),
        personalTargetProfit: String(plan.personalTargetProfit),
        buffer: String(plan.buffer),
        expectedPayout: String(plan.expectedPayout),
      });
      setSubmitError(null);
    }
  }, [plan]);

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSubmitError(null);
  };

  const handleSave = () => {
    if (!plan) return;

    // Basic validation
    const propTpUsd = qNum(formData.propTpUsd);
    const propSlUsd = qNum(formData.propSlUsd);
    const propContracts = qNum(formData.propContracts);
    const personalTargetProfit = qNum(formData.personalTargetProfit);
    const buffer = qNum(formData.buffer);
    const expectedPayout = qNum(formData.expectedPayout);

    if (propTpUsd <= 0 || propSlUsd <= 0) {
      setSubmitError("TP and SL USD amounts must be positive");
      return;
    }

    if (propContracts <= 0) {
      setSubmitError("Contracts must be positive");
      return;
    }

    if (personalTargetProfit <= 0) {
      setSubmitError("Personal target must be positive");
      return;
    }

    if (buffer <= 0) {
      setSubmitError("Buffer must be positive");
      return;
    }

    // Create updates object
    const updates = {
      propTpUsd,
      propSlUsd,
      propContracts,
      personalTargetProfit,
      buffer,
      expectedPayout,
      updatedAt: new Date().toISOString(),
    };

    onSave(plan.id, updates);
    onOpenChange(false);
  };

  if (!plan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Plan - Phase #{plan.phaseNumber}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Prop Side */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-blue-600">Prop Account</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="edit-tp" className="text-xs">TP USD</Label>
                <Input
                  id="edit-tp"
                  type="number"
                  value={formData.propTpUsd}
                  onChange={(e) => updateField("propTpUsd", e.target.value)}
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="edit-sl" className="text-xs">SL USD</Label>
                <Input
                  id="edit-sl"
                  type="number"
                  value={formData.propSlUsd}
                  onChange={(e) => updateField("propSlUsd", e.target.value)}
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="edit-contracts" className="text-xs">Contracts</Label>
                <Input
                  id="edit-contracts"
                  type="number"
                  value={formData.propContracts}
                  onChange={(e) => updateField("propContracts", e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
          </div>

          {/* Personal Side */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-green-600">Personal Hedge</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-target" className="text-xs">Target USD</Label>
                <Input
                  id="edit-target"
                  type="number"
                  value={formData.personalTargetProfit}
                  onChange={(e) => updateField("personalTargetProfit", e.target.value)}
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="edit-buffer" className="text-xs">Buffer</Label>
                <Input
                  id="edit-buffer"
                  type="number"
                  step="0.1"
                  value={formData.buffer}
                  onChange={(e) => updateField("buffer", e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
          </div>

          {/* Expected Payout */}
          <div>
            <Label htmlFor="edit-payout" className="text-xs">Expected Payout USD</Label>
            <Input
              id="edit-payout"
              type="number"
              value={formData.expectedPayout}
              onChange={(e) => updateField("expectedPayout", e.target.value)}
              className="font-mono"
            />
          </div>

          {submitError && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {submitError}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}