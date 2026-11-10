import { listInvestors } from "@/lib/queries";
import { PageHeader } from "@/components/parts";
import { InvestorsTable, NewInvestorButton } from "@/components/investors-view";

export const metadata = { title: "Инвесторы" };

export default async function InvestorsPage() {
  const rows = await listInvestors();
  return (
    <>
      <PageHeader
        title="Инвесторы"
        subtitle="Красным отмечены отрицательные остатки, значком — тройка лидеров по доходу"
        actions={<NewInvestorButton />}
      />
      <InvestorsTable
        rows={rows.map((r) => ({
          id: r.id,
          fullName: r.fullName,
          phone: r.phone,
          status: r.status,
          ...r.counters,
          rank: r.rank,
        }))}
      />
    </>
  );
}
