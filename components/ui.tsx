import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

const VARIANT: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
  secondary: "bg-card text-foreground border border-border hover:bg-muted",
  ghost: "text-foreground hover:bg-muted",
  destructive: "bg-emergency text-white hover:brightness-95",
};

// 44 px minimum touch target on every control (design system: space, radius, elevation).
const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50";

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={cn(BASE, VARIANT[variant], className)} {...props} />;
}

export function ButtonLink({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cn(BASE, VARIANT[variant], className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-xl border border-border bg-card", className)} {...props} />;
}

const FIELD =
  "w-full rounded-md border border-border bg-card px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(FIELD, "min-h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(FIELD, "min-h-24 py-2", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(FIELD, "min-h-11", className)} {...props} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-md bg-emergency-tint px-3 py-2 text-sm text-emergency-text">
      {children}
    </p>
  );
}

export function SectionLabel({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("label-caps text-muted-foreground", className)} {...props} />;
}

export function Notice({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="status" className="rounded-md bg-primary-soft px-3 py-2 text-sm text-primary-hover">
      {children}
    </p>
  );
}
