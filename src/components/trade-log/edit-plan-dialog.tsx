"use client";

import { useState, useEffect } from "react";
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
import { resolveHedgeBuffers } from "@/models/trade-log/hedge-planner";
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
  onSave,
}: EditPlanDialogProps) {
  const [formData, setFormData] = useState({
    propTpUsd: "",
    propSlUsd: "",
    propContracts: "",
    personalTargetProfit: "",
    bufferPropSl: "",
    bufferPropTp: "",
    bufferPersonalTp: "",
    bufferPersonalSl: "",
    expectedPayout: "",
  });

  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (plan) {
      const buffers = resolveHedgeBuffers(plan);
      setFormData({
        propTpUsd: String(plan.propTpUsd),
        propSlUsd: String(plan.propSlUsd),
        propContracts: String(plan.propContracts),
        personalTargetProfit: String(plan.personalTargetProfit),
        bufferPropSl: String(buffers.bufferPropSl),
        bufferPropTp: String(buffers.bufferPropTp),
        bufferPersonalTp: String(buffers.bufferPersonalTp),
        bufferPersonalSl: String(buffers.bufferPersonalSl),
        expectedPayout: String(plan.expectedPayout),
      });
      setSubmitError(null);
    }
  }, [plan]);

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSubmitError(null);
  };

  const handleSave = () => {
    if (!plan) return;

    const propTpUsd = qNum(formData.propTpUsd);
    const propSlUsd = qNum(formData.propSlUsd);
    const propContracts = qNum(formData.propContracts);
    const personalTargetProfit = qNum(formData.personalTargetProfit);
    const bufferPropSl = qNum(formData.bufferPropSl);
    const bufferPropTp = qNum(formData.bufferPropTp);
    const bufferPersonalTp = qNum(formData.bufferPersonalTp);
    const bufferPersonalSl = qNum(formData.bufferPersonalSl);
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

    if (
      bufferPropSl < 0 ||
      bufferPropTp < 0 ||
      bufferPersonalTp < 0 ||
      bufferPersonalSl < 0
    ) {
      setSubmitError("Buffers cannot be negative");
      return;
    }

    onSave(plan.id, {
      propTpUsd,
      propSlUsd,
      propContracts,
      personalTargetProfit,
      buffer: bufferPropSl,
      bufferPropSl,
      bufferPropTp,
      bufferPersonalTp,
      bufferPersonalSl,
      expectedPayout,
      updatedAt: new Date().toISOString(),
    });
    onOpenChange(false);
  };

  if (!plan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Plan - Phase #{plan.phaseNumber}</DialogTitle>
          <DialogDescription>
            Update prop and hedge sizing. Results are recalculated when you execute the plan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-blue-600">Prop Account</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="edit-tp" className="text-xs">
                  TP USD
                </Label>
                <Input
                  id="edit-tp"
                  type="number"
                  value={formData.propTpUsd}
                  onChange={(e) => updateField("propTpUsd", e.target.value)}
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="edit-sl" className="text-xs">
                  SL USD
                </Label>
                <Input
                  id="edit-sl"
                  type="number"
                  value={formData.propSlUsd}
                  onChange={(e) => updateField("propSlUsd", e.target.value)}
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="edit-contracts" className="text-xs">
                  Contracts
                </Label>
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

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-green-600">Personal Hedge</h4>
            <div>
              <Label htmlFor="edit-target" className="text-xs">
                Target USD
              </Label>
              <Input
                id="edit-target"
                type="number"
                value={formData.personalTargetProfit}
                onChange={(e) => updateField("personalTargetProfit", e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-buffer-prop-sl" className="text-xs">
                  Prop SL → personal TP
                </Label>
                <Input
                  id="edit-buffer-prop-sl"
                  type="number"
                  step="0.1"
                  value={formData.bufferPropSl}
                  onChange={(e) => updateField("bufferPropSl", e.target.value)}
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="edit-buffer-prop-tp" className="text-xs">
                  Prop TP → personal SL
                </Label>
                <Input
                  id="edit-buffer-prop-tp"
                  type="number"
                  step="0.1"
                  value={formData.bufferPropTp}
                  onChange={(e) => updateField("bufferPropTp", e.target.value)}
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="edit-buffer-personal-tp" className="text-xs">
                  Personal TP offset
                </Label>
                <Input
                  id="edit-buffer-personal-tp"
                  type="number"
                  step="0.1"
                  value={formData.bufferPersonalTp}
                  onChange={(e) => updateField("bufferPersonalTp", e.target.value)}
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="edit-buffer-personal-sl" className="text-xs">
                  Personal SL offset
                </Label>
                <Input
                  id="edit-buffer-personal-sl"
                  type="number"
                  step="0.1"
                  value={formData.bufferPersonalSl}
                  onChange={(e) => updateField("bufferPersonalSl", e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="edit-payout" className="text-xs">
              Expected Payout USD
            </Label>
            <Input
              id="edit-payout"
              type="number"
              value={formData.expectedPayout}
              onChange={(e) => updateField("expectedPayout", e.target.value)}
              className="font-mono"
            />
          </div>

          {submitError ? (
            <div className="rounded bg-red-50 p-2 text-sm text-red-600">{submitError}</div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
