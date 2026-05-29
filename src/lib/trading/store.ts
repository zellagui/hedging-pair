/**
 * Re-export the Supabase-backed store
 * 
 * This maintains compatibility with existing imports while switching
 * the underlying implementation from localStorage to Supabase.
 */

export * from "@/models/trade-log/store-supabase";
