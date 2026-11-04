import { requireTenant } from "@/lib/auth";
import { AddTicket } from "./add-ticket";

export default async function NewTicketPage() {
  const tenant = await requireTenant();
  return <AddTicket userId={tenant.user_id} flat={tenant.unit.number} building={tenant.building.name} />;
}
