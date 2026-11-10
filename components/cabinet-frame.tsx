"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Bell, ChevronLeft, LogOut } from "lucide-react";
import { Wordmark } from "@/components/parts";
import { postJson } from "@/components/ui/client";
import { formatDateTime } from "@/lib/format";

export interface NotificationView {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  token: string | null;
}

function Bell_({ items }: { items: NotificationView[] }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(items);
  const ref = useRef<HTMLDivElement>(null);
  const unread = list.filter((n) => !n.read).length;

  useEffect(() => {
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      try {
        await postJson("/api/notifications/read");
        setTimeout(() => setList((l) => l.map((n) => ({ ...n, read: true }))), 1500);
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        aria-label="Уведомления"
        aria-expanded={open}
        className="relative grid h-10 w-10 place-items-center rounded-ctl text-white/75 transition-colors hover:bg-white/10 hover:text-white"
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="num absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-tiffany px-1 text-[10px] font-bold leading-none text-ink">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[320px] max-w-[calc(100vw-2rem)] animate-pop overflow-hidden rounded-card border border-line bg-white text-ink">
          <p className="border-b border-line px-4 py-3 text-sm font-semibold">Уведомления</p>
          {list.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-muted">Новых уведомлений нет. Сообщения о квартальных отчётах появятся здесь.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {list.map((n) => {
                const inner = (
                  <>
                    <div className="flex items-start gap-2">
                      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-tiffany" />}
                      <p className="text-[13px] font-medium leading-snug">{n.title}</p>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{n.body}</p>
                    <p className="mt-1.5 text-[11px] text-slate2">{formatDateTime(n.createdAt)}</p>
                  </>
                );
                return (
                  <li key={n.id}>
                    {n.token ? (
                      <Link href={`/report/${n.token}`} className="block px-4 py-3 transition-colors hover:bg-paper" onClick={() => setOpen(false)}>
                        {inner}
                      </Link>
                    ) : (
                      <div className="px-4 py-3">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function CabinetFrame({
  user,
  notifications,
  adminView,
  children,
}: {
  user: { fullName: string };
  notifications: NotificationView[];
  adminView?: boolean;
  children: ReactNode;
}) {
  async function logout() {
    await postJson("/api/auth/logout");
    window.location.href = "/login";
  }
  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 bg-ink">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-4 sm:px-8">
          <Link href="/">
            <Wordmark sub="Кабинет инвестора" />
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            {adminView ? (
              <Link href="/admin" className="inline-flex h-10 items-center gap-1 rounded-ctl px-3 text-sm text-white/75 hover:bg-white/10 hover:text-white">
                <ChevronLeft size={16} /> В админ-панель
              </Link>
            ) : (
              <>
                <Bell_ items={notifications} />
                <span className="mx-2 hidden h-6 w-px bg-white/10 sm:block" />
                <span className="hidden max-w-[200px] truncate text-sm text-white/70 sm:block">{user.fullName}</span>
                <button onClick={logout} aria-label="Выйти" title="Выйти" className="grid h-10 w-10 place-items-center rounded-ctl text-white/60 transition-colors hover:bg-white/10 hover:text-white">
                  <LogOut size={17} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      {adminView && (
        <div className="no-print border-b border-sand bg-[#F8F3E4] px-4 py-2 text-center text-[13px] text-[#6B5A22]">
          Режим просмотра администратора — вы видите отчёт глазами инвестора
        </div>
      )}
      <main className="print-root mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-8 sm:py-10">{children}</main>
    </div>
  );
}
