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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tradeRowLabel } from "@/components/trade-log/trades-table";
import { useTradingStore } from "@/models/trade-log/store";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorTradeId: string | null;
};

function anchorDefaults(
  anchorTradeId: string | null,
  trades: { id: string; challengeId: string | null }[],
  pairedIds: Set<string>
): { prop: string; personal: string; lockProp: boolean; lockPersonal: boolean } {
  if (!anchorTradeId || pairedIds.has(anchorTradeId)) {
    return { prop: "", personal: "", lockProp: false, lockPersonal: false };
  }
  const t = trades.find((x) => x.id === anchorTradeId);
  if (!t) {
    return { prop: "", personal: "", lockProp: false, lockPersonal: false };
  }
  if (t.challengeId != null) {
    return {
      prop: anchorTradeId,
      personal: "",
      lockProp: true,
      lockPersonal: false,
    };
  }
  return {
    prop: "",
    personal: anchorTradeId,
    lockProp: false,
    lockPersonal: true,
  };
}

export function PairLinkDialog({ open, onOpenChange, anchorTradeId }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <PairLinkFormInner
          key={anchorTradeId ?? "none"}
          anchorTradeId={anchorTradeId}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </Dialog>
  );
}

function PairLinkFormInner({
  anchorTradeId,
  onClose,
}: {
  anchorTradeId: string | null;
  onClose: () => void;
}) {
  const trades = useTradingStore((s) => s.trades);
  const pairs = useTradingStore((s) => s.pairs);
  const linkPair = useTradingStore((s) => s.linkPair);

  const pairedIds = useMemo(() => {
    const set = new Set<string>();
    for (const p of pairs) {
      set.add(p.propTradeId);
      set.add(p.personalTradeId);
    }
    return set;
  }, [pairs]);

  const { prop: defaultProp, personal: defaultPersonal, lockProp, lockPersonal } =
    useMemo(
      () => anchorDefaults(anchorTradeId, trades, pairedIds),
      [anchorTradeId, trades, pairedIds]
    );

  const [propId, setPropId] = useState(defaultProp);
  const [personalId, setPersonalId] = useState(defaultPersonal);
  const [error, setError] = useState<string | null>(null);

  const propCandidates = useMemo(
    () =>
      trades.filter(
        (t) =>
          t.challengeId != null &&
          !pairedIds.has(t.id) &&
          t.id !== personalId
      ),
    [trades, pairedIds, personalId]
  );

  const personalCandidates = useMemo(
    () =>
      trades.filter(
        (t) =>
          t.challengeId == null &&
          !pairedIds.has(t.id) &&
          t.id !== propId
      ),
    [trades, pairedIds, propId]
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!propId || !personalId) {
      setError("Select both trades.");
      return;
    }
    const res = linkPair(propId, personalId);
    if (!res) {
      setError(
        "Could not link — prop leg needs a challenge, personal leg must be unassigned, both unpaired."
      );
      return;
    }
    onClose();
  }

  return (
    <DialogContent className="sm:max-w-md">
      <form onSubmit={onSubmit}>
        <DialogHeader>
          <DialogTitle>Link hedge pair</DialogTitle>
          <DialogDescription>
            Prop trade must have a challenge; personal trade must not.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Prop trade</Label>
            <Select
              value={propId || undefined}
              onValueChange={setPropId}
              disabled={lockProp}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select prop trade" />
              </SelectTrigger>
              <SelectContent>
                {propCandidates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {tradeRowLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Personal trade</Label>
            <Select
              value={personalId || undefined}
              onValueChange={setPersonalId}
              disabled={lockPersonal}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select personal trade" />
              </SelectTrigger>
              <SelectContent>
                {personalCandidates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {tradeRowLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Link</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
