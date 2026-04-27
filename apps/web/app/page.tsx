import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/auth";

export default async function HomePage() {
  const { user } = await getServerAuth();

  if (user) redirect("/dashboard");
  redirect("/login");
}
