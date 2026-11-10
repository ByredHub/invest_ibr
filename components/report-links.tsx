"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Link2 } from "lucide-react";
import { EmptyState } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";

export interface LinkRow {
  id: string;
  token: string;
  label: string;
  createdAt: string;
  investor: { id: string; fullName: string };
}

function CopyButton({ token }: { token: string }) {
  const toast = useToast();
  const [done, setDone] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/report/${token}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setDone(true);
    toast.push("success", "Ссылка скопирована");
    setTimeout(() => setDone(false), 1800);
  }

  return (
    <button onClick={copy} className="btn-ghost h-8 gap-1.5 px-3 text-[13px]">
      {done ? <Check size={14} className="text-tiffany-700" /> : <Copy size={14} />}
      {done ? "Скопировано" : "Копировать"}
    </button>
  );
}

export function ReportLinks({ rows, showInvestor = true }: { rows: LinkRow[]; showInvestor?: boolean }) {
  if (rows.length === 0) {
    return <EmptyState icon={<Link2 size={18} />} title="Ссылок пока нет" text="Ссылки появятся после закрытия отчётного периода." />;
  }
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-[#FBFAF7] sm:px-5">
          <div className="min-w-[160px] flex-1">
            {showInvestor && (
              <Link href={`/admin/investors/${r.investor.id}`} className="text-sm font-medium hover:underline">
                {r.investor.fullName}
              </Link>
            )}
            <p className="text-xs text-muted">
              {r.label} · {formatDateTime(r.createdAt)}
            </p>
          </div>
          <code className="hidden max-w-[230px] truncate rounded-md border border-line bg-paper px-2 py-1 text-[11px] text-muted md:block">
            /report/{r.token.slice(0, 14)}…
          </code>
          <div className="flex items-center gap-2">
            <CopyButton token={r.token} />
            <Link href={`/report/${r.token}`} target="_blank" className="btn-ghost h-8 w-8 px-0" aria-label="Открыть отчёт" title="Открыть отчёт">
              <ExternalLink size={14} />
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
