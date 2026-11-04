import { redirect } from "next/navigation";
import { homeFor } from "@/lib/auth";

export default async function Root() {
  redirect(await homeFor());
}
