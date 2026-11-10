import { redirect } from "next/navigation";
import { ShieldCheck, LineChart, FileText } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { Wordmark } from "@/components/parts";
import { LoginForm } from "./login-form";

export const metadata = { title: "Вход" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getSessionUser();
  const { next } = await searchParams;
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/cabinet");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-white lg:flex">
        <svg className="pointer-events-none absolute -right-24 -top-24 h-[520px] w-[520px] text-tiffany opacity-[0.07]" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={30 + i * 6} y={30 + i * 6} width={140 - i * 12} height={140 - i * 12} transform={`rotate(${i * 7.5} 100 100)`} />
          ))}
        </svg>
        <Wordmark sub="Кабинет инвестора" />
        <div className="relative max-w-md">
          <p className="label-caps !text-tiffany">Закрытый клуб инвесторов</p>
          <h1 className="mt-4 text-[38px] font-semibold leading-[1.1] tracking-tight">
            Ваш капитал — под&nbsp;прозрачным контролем
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-white/60">
            Состав портфеля, доходность и квартальные отчёты IBR Group в одном защищённом кабинете.
          </p>
          <ul className="mt-10 space-y-4 text-sm text-white/75">
            {[
              [LineChart, "Структура портфеля и доход по месяцам"],
              [FileText, "Квартальные отчёты с выгрузкой в PDF"],
              [ShieldCheck, "Только просмотр, доступ только к вашим данным"],
            ].map(([Icon, text], i) => {
              const I = Icon as typeof LineChart;
              return (
                <li key={i} className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-tiffany">
                    <I size={16} />
                  </span>
                  {text as string}
                </li>
              );
            })}
          </ul>
        </div>
        <p className="relative text-xs text-white/35">© IBR Group. Конфиденциально.</p>
      </section>

      <section className="flex flex-col justify-center bg-paper px-6 py-12 sm:px-14">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Wordmark dark sub="Кабинет инвестора" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Вход в кабинет</h2>
          <p className="mt-1.5 text-sm text-muted">Введите телефон и пароль, выданные менеджером IBR.</p>
          <LoginForm next={safeNext} />
          <p className="mt-8 text-xs leading-relaxed text-muted">
            Нет доступа или забыли пароль? Обратитесь к вашему персональному менеджеру — пароль может сбросить только администратор.
          </p>
        </div>
      </section>
    </main>
  );
}
