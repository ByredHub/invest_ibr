"use client";

import { useState, type ReactNode } from "react";

export interface TabDef {
  id: string;
  label: string;
  count?: number;
  content: ReactNode;
}

export function Tabs({ tabs }: { tabs: TabDef[] }) {
  const [active, setActive] = useState(tabs[0].id);
  return (
    <div className="card overflow-hidden">
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-2">
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t.id)}
              className={`relative flex shrink-0 items-center gap-2 px-3 pb-3 pt-2 text-sm font-medium transition-colors duration-150 ${on ? "text-ink" : "text-muted hover:text-ink"}`}
            >
              {t.label}
              {t.count !== undefined && (
                <span className={`num rounded-full px-1.5 text-[11px] ${on ? "bg-ink text-white" : "bg-paper text-muted"}`}>{t.count}</span>
              )}
              {on && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-tiffany" />}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={t.id !== active}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
