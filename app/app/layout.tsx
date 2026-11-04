import { requireTenant } from "@/lib/auth";
import { BottomNav } from "./bottom-nav";

// Tenant app: mobile-first, bottom navigation Home · Add · History · Profile · Messages (product.md §8).
export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  await requireTenant();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <main className="flex flex-1 flex-col gap-4 px-4 pt-6 pb-28">{children}</main>
      <BottomNav />
    </div>
  );
}
