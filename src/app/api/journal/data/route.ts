import { NextResponse } from "next/server";

import { loadJournalDataForCurrentUser } from "@/lib/supabase/load-journal-data";

export async function GET() {
  const { initialData, error } = await loadJournalDataForCurrentUser();

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  if (!initialData) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({ data: initialData });
}
