import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/shell/dashboard-shell";
import { getServerAuth } from "@/lib/supabase/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getServerAuth();

  if (!user) {
    redirect("/login");
  }

  const meta = user.user_metadata as Record<string, string | undefined> | undefined;
  const fullName = meta?.full_name?.trim();
  const displayName = fullName || user.email?.split("@")[0] || "User";

  return (
    <DashboardShell userId={user.id} userEmail={user.email ?? ""} displayName={displayName}>
      {children}
    </DashboardShell>
  );
}
