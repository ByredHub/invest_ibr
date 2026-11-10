import { PackageOpen } from "lucide-react";
import { Money, TickerChip } from "@/components/parts";
import { EmptyState } from "@/components/ui/field";
import { formatDate, formatQty } from "@/lib/format";

export interface AssetView {
  id: string;
  name: string;
  ticker: string;
  quantity: string;
  unitPriceKop: number;
  totalKop: number;
  fileId: string;
  purchasedAt: string | Date;
}

export function AssetsGrid({ assets, emptyText }: { assets: AssetView[]; emptyText?: string }) {
  if (assets.length === 0) {
    return <EmptyState icon={<PackageOpen size={18} />} title="Активов пока нет" text={emptyText ?? "Купленные активы с фотографиями появятся здесь."} />;
  }
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
      {assets.map((a) => (
        <article key={a.id} className="group overflow-hidden rounded-card border border-line bg-white transition-colors duration-150 hover:border-[#d3cfc3]">
          <div className="aspect-[4/3] overflow-hidden bg-paper">
            <img
              src={`/api/files/${a.fileId}`}
              alt={a.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </div>
          <div className="p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold leading-snug tracking-tight">{a.name}</h3>
              <TickerChip ticker={a.ticker} />
            </div>
            <p className="mt-3 text-[22px] font-semibold leading-none tracking-tight">
              <Money kop={a.totalKop} currencyClass="text-[15px]" />
            </p>
            <p className="num mt-2.5 text-xs text-muted">
              {formatQty(a.quantity)} × <Money kop={a.unitPriceKop} /> · {formatDate(a.purchasedAt)}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
