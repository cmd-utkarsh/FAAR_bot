"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/bulk", label: "Bulk Sweep" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 min-h-screen border-r bg-card p-4 flex flex-col gap-2">
      <div className="mb-6 px-2">
        <h1 className="text-lg font-bold tracking-tight">FAAR_bot</h1>
        <p className="text-xs text-muted-foreground">Auto-Reply Bot</p>
      </div>
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "px-3 py-2 rounded-md text-sm font-medium transition-colors",
              pathname.startsWith(item.href)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
