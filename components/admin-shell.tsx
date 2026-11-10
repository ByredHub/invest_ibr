"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { History, LayoutDashboard, LogOut, Menu, Users, CalendarCheck, HandCoins, X } from "lucide-react";
import { Wordmark } from "@/components/parts";
import { initials } from "@/lib/format";
import { postJson } from "@/components/ui/client";

const NAV = [
  { href: "/admin", label: "Обзор", icon: LayoutDashboard, exact: true },
  { href: "/admin/investors", label: "Инвесторы", icon: Users },
  { href: "/admin/history", label: "История", icon: History },
  { href: "/admin/quarters", label: "Кварталы", icon: CalendarCheck },
  { href: "/admin/payouts", label: "Заявки на вывод", icon: HandCoins, badge: true },
];

export async function logout() {
  await postJson("/api/auth/logout");
  window.location.href = "/login";
}

export function AdminShell({ user, pendingCount, children }: { user: { fullName: string; phone: string }; pendingCount: number; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="mt-8 flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon, exact, badge }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 ${
              active ? "bg-white/[0.07] text-white" : "text-white/60 hover:bg-white/[0.04] hover:text-white"
            }`}
          >
            {active && <span className="absolute -left-4 top-2 h-6 w-[3px] rounded-r bg-tiffany" />}
            <Icon size={17} className={active ? "text-tiffany" : "text-white/45 group-hover:text-white/70"} />
            <span className="flex-1">{label}</span>
            {badge && pendingCount > 0 && (
              <span className="num grid h-5 min-w-5 place-items-center rounded-full bg-tiffany px-1.5 text-[11px] font-bold leading-none text-ink">{pendingCount}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const userBlock = (
    <div className="mt-auto border-t border-white/10 pt-4">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-semibold text-white">{initials(user.fullName)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-white">{user.fullName}</p>
          <p className="text-[11px] text-white/40">Администратор</p>
        </div>
        <button onClick={logout} aria-label="Выйти" title="Выйти" className="rounded-md p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white">
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {open && <div className="fixed inset-0 z-40 animate-fade bg-ink/50 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-y-auto bg-ink px-4 py-6 transition-transform duration-200 lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:shrink-0 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-1">
          <Wordmark sub="Администратор" />
          <button onClick={() => setOpen(false)} aria-label="Закрыть" className="rounded-md p-1.5 text-white/60 lg:hidden">
            <X size={18} />
          </button>
        </div>
        {nav}
        {userBlock}
      </aside>

      <div className="min-w-0 flex-1">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between bg-ink px-4 lg:hidden">
          <Wordmark sub="Администратор" />
          <button onClick={() => setOpen(true)} aria-label="Меню" className="rounded-md p-2 text-white">
            <Menu size={20} />
          </button>
        </header>
        <main className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-8 sm:py-9">{children}</main>
      </div>
    </div>
  );
}
