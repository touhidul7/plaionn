import { notFound, redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/supabase/admin";

export default async function AdminLeagueLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ leagueId: string }>;
}) {
  const access = await getAdminAccess();
  if (!access.user) redirect("/login");
  if (!access.canManageLeague((await params).leagueId)) notFound();
  return children;
}
