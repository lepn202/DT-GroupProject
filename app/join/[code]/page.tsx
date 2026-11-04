import { notFound } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/server";
import { JoinForm } from "./join-form";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("invite_lookup", { code });
  const rows = (data ?? []) as { building_name: string; address: string; unit_id: string; unit_number: string; floor: number }[];
  if (!rows.length) notFound();

  return (
    <AuthShell title={`Join ${rows[0].building_name}`} subtitle={`${rows[0].address}. Create your account to report problems and follow repairs.`}>
      <JoinForm code={code} units={rows.map((r) => ({ id: r.unit_id, number: r.unit_number, floor: r.floor }))} />
    </AuthShell>
  );
}
