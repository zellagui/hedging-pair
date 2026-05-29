import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function hasSupabaseEnvVars(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export async function GET() {
  if (!hasSupabaseEnvVars()) {
    return NextResponse.json(
      { ok: false, error: "Supabase environment variables are not configured" },
      { status: 503 },
    );
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();

    if (error && error.message !== "Auth session missing!") {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      user: data.user
        ? { id: data.user.id, email: data.user.email ?? null }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
