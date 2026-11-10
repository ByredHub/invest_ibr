"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { formatMonth, formatRub } from "@/lib/format";

const SHORT = new Intl.DateTimeFormat("ru-RU", { month: "short", timeZone: "UTC" });

function lastMonths(endKey: string, n: number): string[] {
  const [y, m] = endKey.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

export function IncomeChart({ income, endMonth }: { income: { month: string; amountKop: number }[]; endMonth: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const data = useMemo(() => {
    const map = new Map(income.map((i) => [i.month, i.amountKop]));
    return lastMonths(endMonth, 12).map((m) => ({
      month: m,
      label: SHORT.format(new Date(`${m}-01T00:00:00Z`)).replace(".", ""),
      kop: map.get(m) ?? 0,
    }));
  }, [income, endMonth]);

  return (
    <div className="h-[220px] w-full">
      {mounted && (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="#E7E4DC" strokeDasharray="3 3" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} interval={0} />
            <Tooltip
              cursor={{ fill: "#F6F5F1" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as { month: string; kop: number };
                return (
                  <div className="rounded-ctl border border-ink-700 bg-ink px-3 py-2 text-xs text-white">
                    <p className="text-white/60">{formatMonth(p.month)}</p>
                    <p className="num mt-0.5 text-sm font-semibold">{formatRub(p.kop)}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="kop" fill="#57cfcb" radius={[4, 4, 0, 0]} isAnimationActive={false} minPointSize={2} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
