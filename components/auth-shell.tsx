import { APP_NAME } from "@/lib/config";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-4 py-12">
      <div className="flex flex-col gap-2">
        <span className="label-caps text-primary">{APP_NAME}</span>
        <h1 className="text-[28px] leading-[34px] font-bold tracking-[-0.01em]">{title}</h1>
        {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </main>
  );
}
