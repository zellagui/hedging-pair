"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Overview" },
  { href: "/identities", label: "Workspaces" },
  { href: "/challenges", label: "Challenges" },
  { href: "/data", label: "Data" },
] as const;

export function JournalNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label="Journal">
      {links.map(({ href, label }) => {
        const active =
          href === "/"
            ? pathname === "/" || pathname === ""
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
