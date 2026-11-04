"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, Home, MessageCircle, Plus, User } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/new", label: "Add", icon: Plus, primary: true },
  { href: "/app/history", label: "History", icon: History },
  { href: "/app/profile", label: "Profile", icon: User },
  { href: "/app/messages", label: "Messages", icon: MessageCircle },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon, primary }) => {
          const active = href === "/app" ? path === "/app" : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {primary ? (
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Icon className="size-5" strokeWidth={2} aria-hidden />
                  </span>
                ) : (
                  <Icon className="size-6" strokeWidth={1.75} aria-hidden />
                )}
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
