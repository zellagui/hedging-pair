import { LogoutButton } from "@/components/auth/logout-button";
import { createClient } from "@/lib/supabase/server";

export async function JournalUserMenu() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      {user.email ? (
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {user.email}
        </span>
      ) : null}
      <LogoutButton />
    </div>
  );
}
