"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTradingStore } from "@/models/trade-log/store";

export default function IdentityHubPage() {
  const router = useRouter();
  const raw = useParams().identityId;
  const identityId = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  
  const setActiveIdentityId = useTradingStore((s) => s.setActiveIdentityId);
  
  useEffect(() => {
    if (identityId) {
      // Set the active workspace and redirect to challenges page
      setActiveIdentityId(identityId);
    }
    // Redirect to challenges page - the workspace selector will be pre-selected
    router.replace("/challenges");
  }, [identityId, router, setActiveIdentityId]);

  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <p className="text-muted-foreground">Redirecting to challenges...</p>
    </div>
  );
}
