"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Archive, Building2, LayoutGrid, LogOut, Menu, Plus, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FixaLockup } from "@/components/logo";

type Props = {
  appName: string;
  landlordName: string;
  mode: "automatic" | "manual";
  buildings: { id: string; name: string }[];
  signOut: () => Promise<void>;
};

export function Sidebar({ appName, landlordName, mode, buildings, signOut }: Props) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const item = (href: string, label: string, icon: React.ReactNode, active: boolean) => (
    <Link
      key={href}
      href={href}
      onClick={() => setOpen(false)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-10 items-center gap-2.5 rounded-md px-3 text-[15px]",
        active ? "bg-primary-soft font-semibold text-primary-hover" : "text-foreground hover:bg-muted",
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  );
  const iconCls = "size-[18px] shrink-0";

  return (
    <aside className="border-b border-border bg-card lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
      <div className="flex items-center justify-between px-4 py-4 lg:px-5 lg:py-6">
        <Link href="/dashboard" aria-label={`${appName} home`}>
          <FixaLockup />
        </Link>
        <button className="flex size-11 items-center justify-center rounded-md lg:hidden" onClick={() => setOpen((o) => !o)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </div>
      <nav className={cn("flex-col gap-6 px-3 pb-4 lg:flex", open ? "flex" : "hidden")} aria-label="Dashboard">
        <div className="flex flex-col gap-0.5">
          {item("/dashboard", "Portfolio", <LayoutGrid className={iconCls} strokeWidth={1.75} aria-hidden />, path === "/dashboard")}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="label-caps px-3 pb-1 text-muted-foreground">Buildings</span>
          {buildings.map((b) =>
            item(
              `/dashboard/buildings/${b.id}`,
              b.name,
              <Building2 className={iconCls} strokeWidth={1.75} aria-hidden />,
              path.startsWith(`/dashboard/buildings/${b.id}`),
            ),
          )}
          {item("/dashboard/buildings/new", "Add building", <Plus className={iconCls} strokeWidth={1.75} aria-hidden />, path === "/dashboard/buildings/new")}
        </div>
        <div className="flex flex-col gap-0.5">
          {item("/dashboard/archive", "Archive", <Archive className={iconCls} strokeWidth={1.75} aria-hidden />, path.startsWith("/dashboard/archive"))}
          {item("/dashboard/settings", "Settings", <Settings className={iconCls} strokeWidth={1.75} aria-hidden />, path.startsWith("/dashboard/settings"))}
        </div>
        <Link href="/dashboard/settings" className="mx-1 flex flex-col gap-0.5 rounded-lg border border-border px-3 py-2.5 hover:bg-muted">
          <span className="label-caps text-muted-foreground">Mode</span>
          <span className="font-semibold capitalize">{mode}</span>
          <span className="text-[13px] text-muted-foreground">
            {mode === "automatic" ? "The AI books technicians. You monitor." : "You confirm each booking."}
          </span>
        </Link>
        <form action={signOut} className="mx-1 flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span className="truncate">{landlordName}</span>
          <button className="flex min-h-10 items-center gap-1.5 rounded-md px-2 hover:bg-muted hover:text-foreground">
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </form>
      </nav>
    </aside>
  );
}
