import { cn } from "@/lib/utils";

export function PageHeader({ crumbs, title, subtitle, actions }: { crumbs?: React.ReactNode; title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        {crumbs && <div className="text-sm text-muted-foreground">{crumbs}</div>}
        <h1 className="text-[28px] leading-[34px] font-bold tracking-[-0.01em]">{title}</h1>
        {subtitle && <div className="text-muted-foreground">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function KpiTile({ label, value, note, tone, main }: { label: string; value: React.ReactNode; note?: string; tone?: "alert"; main?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border p-4",
        tone === "alert" ? "border-emergency bg-emergency-tint text-emergency-text" : "border-border bg-card",
        main && "sm:col-span-2 lg:col-span-1",
      )}
    >
      <span className={cn("label-caps", tone === "alert" ? "" : "text-muted-foreground")}>{label}</span>
      <span className={cn("font-bold tracking-tight", main ? "text-[40px] leading-[44px]" : "text-[28px] leading-[34px]")}>{value}</span>
      {note && <span className={cn("text-[13px]", tone === "alert" ? "" : "text-muted-foreground")}>{note}</span>}
    </div>
  );
}

export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8", className)}>{children}</div>;
}
