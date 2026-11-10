"use client";

import { useEffect, useState } from "react";
import { Cell, Pie, PieChart } from "recharts";
import { formatRub } from "@/lib/format";

export const CHART_COLORS = ["#57cfcb", "#041121", "#D6C7A1", "#8A9BA8", "#1F6F6B"];
const OTHER = "#BFC9CF";

export interface Slice {
  name: string;
  kop: number;
  kind: "asset" | "other" | "balance";
}

export function sliceColor(s: Slice, i: number) {
  return s.kind === "balance" ? "#E3E0D6" : s.kind === "other" ? OTHER : CHART_COLORS[i % CHART_COLORS.length];
}

export function PortfolioDonut({ slices, totalKop }: { slices: Slice[]; totalKop: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const sum = slices.reduce((s, x) => s + x.kop, 0);
  const sum100 = sum || 1;
  const data = sum ? slices : [{ name: "Пусто", kop: 1, kind: "balance" as const }];

  return (
    <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center sm:gap-10">
      <div className="relative h-[232px] w-[232px] shrink-0">
        {mounted && (
        <PieChart width={232} height={232}>
          <Pie
            data={data}
            dataKey="kop"
            nameKey="name"
            innerRadius={78}
            outerRadius={112}
            paddingAngle={data.length > 1 ? 2 : 0}
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((s, i) => (
              <Cell key={i} fill={sliceColor(s, i)} />
            ))}
          </Pie>
        </PieChart>
        )}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="label-caps">Всего</span>
          <span className="num mt-1 text-lg font-semibold tracking-tight">{formatRub(totalKop)}</span>
        </div>
      </div>

      <ul className="w-full min-w-0 flex-1 divide-y divide-line">
        {slices.map((s, i) => (
          <li key={i} className="flex items-center gap-3 py-2.5 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: sliceColor(s, i) }} />
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            <span className="num text-xs text-muted">{((s.kop / sum100) * 100).toFixed(1).replace(".", ",")}%</span>
            <span className="num w-[110px] text-right font-medium">{formatRub(s.kop)}</span>
          </li>
        ))}
        {slices.length === 0 && <li className="py-6 text-sm text-muted">Портфель пока пуст</li>}
      </ul>
    </div>
  );
}
