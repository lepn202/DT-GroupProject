import { requireLandlord } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { landlordBuildings } from "@/lib/landlord-data";
import { signOut } from "@/lib/actions/auth";
import { Sidebar } from "./sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const landlord = await requireLandlord();
  const buildings = await landlordBuildings();
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Sidebar
        appName={APP_NAME}
        landlordName={landlord.name}
        mode={landlord.mode}
        buildings={buildings.map((b) => ({ id: b.id, name: b.name }))}
        signOut={signOut}
      />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
