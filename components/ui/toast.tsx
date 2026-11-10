"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

type Kind = "success" | "error";
interface Toast {
  id: number;
  kind: Kind;
  text: string;
}

const Ctx = createContext<{ push: (kind: Kind, text: string) => void }>({ push: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (kind: Kind, text: string) => {
      const id = Date.now() + Math.random();
      setItems((l) => [...l, { id, kind, text }]);
      setTimeout(() => dismiss(id), kind === "error" ? 6000 : 3800);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-5 sm:items-end">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex w-full max-w-sm animate-pop items-start gap-3 rounded-card border border-ink-700 bg-ink px-4 py-3 text-sm text-white sm:w-auto"
          >
            {t.kind === "success" ? (
              <CheckCircle2 size={18} className="mt-px shrink-0 text-tiffany" />
            ) : (
              <AlertCircle size={18} className="mt-px shrink-0 text-[#f0906a]" />
            )}
            <span className="leading-snug">{t.text}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Закрыть" className="ml-1 text-white/50 transition-colors hover:text-white">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
