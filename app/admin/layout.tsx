import { pageRequireAdmin } from "@/lib/auth";
import { pendingWithdrawalCount } from "@/lib/queries";
import { AdminShell } from "@/components/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await pageRequireAdmin();
  const pendingCount = await pendingWithdrawalCount();
  return <AdminShell user={{ fullName: user.fullName, phone: user.phone }} pendingCount={pendingCount}>{children}</AdminShell>;
}
