import type { ReactNode } from "react";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label-caps mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-snug text-muted">{hint}</span>}
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-ctl border border-brick/25 bg-brick-50 px-3 py-2 text-[13px] leading-snug text-brick">
      {message}
    </p>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />;
}

export function EmptyState({ title, text, icon }: { title: string; text?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-4 grid h-11 w-11 place-items-center rounded-full border border-line bg-paper text-muted">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {text && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">{text}</p>}
    </div>
  );
}
