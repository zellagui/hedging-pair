"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function IdentitiesPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to challenges page since workspaces are now managed there
    router.replace("/challenges");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <p className="text-muted-foreground">Redirecting to challenges...</p>
    </div>
  );
}
