import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { pageRequireUser } from "@/lib/auth";
import { loadNotifications, loadReportTabs } from "@/lib/cabinet";
import { parseSnapshot } from "@/lib/snapshot";
import { CabinetFrame } from "@/components/cabinet-frame";
import { ReportView } from "@/components/report-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Инвестиционный отчёт" };

export default async function ReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await pageRequireUser(`/report/${token}`);
  const report = await db.report.findUnique({ where: { token } });
  if (!report || (user.role !== "ADMIN" && report.userId !== user.id)) notFound();

  const isAdmin = user.role === "ADMIN";
  const [tabs, notifications] = await Promise.all([loadReportTabs(report.userId), isAdmin ? [] : loadNotifications(user.id)]);
  return (
    <CabinetFrame user={{ fullName: user.fullName }} notifications={notifications} adminView={isAdmin}>
      <ReportView snapshot={parseSnapshot(report.snapshot)} current={token} all={tabs} />
    </CabinetFrame>
  );
}
