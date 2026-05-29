export const GUEST_ONLY_AUTH_PATHS = ["/auth/login", "/auth/sign-up"] as const;

export function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/supabase/health")
  );
}

export function isGuestOnlyAuthPath(pathname: string): boolean {
  return GUEST_ONLY_AUTH_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function safeNextPath(next: string | null): string {
  if (next == null || next === "" || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }
  return next;
}
