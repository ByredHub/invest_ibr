import { db } from "@/lib/db";
import { periodLabel } from "@/lib/service";
import type { NotificationView } from "@/components/cabinet-frame";

export async function loadNotifications(userId: string): Promise<NotificationView[]> {
  const list = await db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 });
  const reportIds = list.map((n) => n.reportId).filter((x): x is string => !!x);
  const reports = reportIds.length
    ? await db.report.findMany({ where: { id: { in: reportIds }, userId }, select: { id: true, token: true } })
    : [];
  const tokens = new Map(reports.map((r) => [r.id, r.token]));
  return list.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    createdAt: n.createdAt.toISOString(),
    read: !!n.readAt,
    token: n.reportId ? (tokens.get(n.reportId) ?? null) : null,
  }));
}

export async function loadReportTabs(userId: string) {
  const reports = await db.report.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { token: true, quarter: { select: { seq: true, startAt: true, endAt: true } } },
  });
  return reports.map((r) => ({ token: r.token, label: periodLabel(r.quarter.seq, r.quarter.startAt, r.quarter.endAt) }));
}
