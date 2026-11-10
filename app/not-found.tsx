import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-6">
      <div className="max-w-sm text-center">
        <p className="label-caps">Ошибка 404</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Страница не найдена</h1>
        <p className="mt-2 text-sm text-muted">Возможно, ссылка устарела или у вас нет доступа к этому отчёту.</p>
        <Link href="/" className="btn-primary mt-6">На главную</Link>
      </div>
    </main>
  );
}
