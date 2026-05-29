"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useTradingStore } from "@/models/trade-log/store";
import { clearLegacyTradeLogLocalStorage } from "@/models/trade-log/storage";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearLegacyTradeLogLocalStorage();
    useTradingStore.setState({
      sessions: [],
      trades: [],
      pairs: [],
      challenges: [],
      identities: [],
      plans: [],
      activeIdentityId: null,
      isHydrated: false,
      isLoading: false,
      error: null,
    });
    router.push("/auth/login");
    router.refresh();
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={logout}>
      Sign out
    </Button>
  );
}
