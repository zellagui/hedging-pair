import { fetchAllUserData } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import type { LoadedJournalData } from "@/lib/trading/process-loaded-journal-data";

export async function loadJournalDataForCurrentUser(): Promise<{
  initialData: LoadedJournalData | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { initialData: null, error: null };
  }

  const result = await fetchAllUserData(supabase);

  if (result.error || !result.data) {
    return {
      initialData: null,
      error: result.error ?? "Failed to load journal data",
    };
  }

  return { initialData: result.data, error: null };
}
