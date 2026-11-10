import { pageRequireInvestor } from "@/lib/auth";
import { loadNotifications } from "@/lib/cabinet";
import { CabinetFrame } from "@/components/cabinet-frame";

export const dynamic = "force-dynamic";

export default async function CabinetLayout({ children }: { children: React.ReactNode }) {
  const user = await pageRequireInvestor();
  const notifications = await loadNotifications(user.id);
  return (
    <CabinetFrame user={{ fullName: user.fullName }} notifications={notifications}>
      {children}
    </CabinetFrame>
  );
}
