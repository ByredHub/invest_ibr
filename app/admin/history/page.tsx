import Link from "next/link";
import { History } from "lucide-react";
import { listAudit } from "@/lib/queries";
import { PageHeader } from "@/components/parts";
import { AuditList } from "@/components/audit-list";
import { EmptyState } from "@/components/ui/field";

export const metadata = { title: "История" };
const PAGE = 40;

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const { items, total } = await listAudit({ take: PAGE, skip: (page - 1) * PAGE });
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <>
      <PageHeader title="История действий" subtitle={`Журнал всех операций администратора · записей: ${total}`} />
      <div className="card overflow-hidden">
        <AuditList items={items} empty={<EmptyState icon={<History size={18} />} title="Журнал пуст" text="Действия появятся после первых операций." />} />
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
            <span className="text-muted">
              Страница {page} из {pages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link className="btn-ghost h-9" href={`/admin/history?page=${page - 1}`}>
                  Назад
                </Link>
              )}
              {page < pages && (
                <Link className="btn-ghost h-9" href={`/admin/history?page=${page + 1}`}>
                  Далее
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
